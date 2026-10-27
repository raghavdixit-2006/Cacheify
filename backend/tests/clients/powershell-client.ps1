# Framework client test - PowerShell
# Transport: Invoke-RestMethod (Windows PowerShell's dedicated HTTP cmdlet, .NET HttpClient underneath).
# Shared scenario with the other clients: see tests/clients/README.md.
# Expiry idiom for this client: SET key value PX <milliseconds> (milliseconds flavor).
# Output note: ASCII-only log lines (PowerShell 5.1 reads BOM-less scripts as ANSI).
$ErrorActionPreference = 'Stop'
$Base = if ($env:RH_BASE_URL) { $env:RH_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3000' }
$Email = 'qa-review@redishost.test'
$Password = 'review-pass-77'

$Lang = 'powershell'
$Epoch = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$DbName = "fw-lab-$Lang-$Epoch"
$Key = "fw:$Lang`:session"
$HitsKey = "fw:$Lang`:hits"
$Payload = '{"lang":"powershell","saved":"' + [DateTime]::UtcNow.ToString('o') + '","note":"framework TTL test"}'

$script:Checks = 0
$script:Failures = 0
$script:Ids = @{}

function Write-Log([string]$Line) { Write-Host $line }
function Get-Mask([string]$Token) { return $Token.Substring(0, 8) + '...' }

function Assert([string]$Name, [bool]$Ok, [string]$Detail = '') {
  $script:Checks++
  if (-not $Ok) { $script:Failures++ }
  $mark = if ($Ok) { 'PASS' } else { 'FAIL' }
  $suffix = ''
  if ($Detail -ne '') { $suffix = " -- $Detail" }
  Write-Log ("  {0}  {1}{2}" -f $mark, $Name, $suffix)
}

function Invoke-Api {
  param([string]$Method, [string]$Path, [string]$Token, $Body)
  $headers = @{}
  if ($Token) { $headers['Authorization'] = "Bearer $Token" }
  $params = @{ Method = $Method; Uri = "$Base$Path"; Headers = $headers; ContentType = 'application/json'; UseBasicParsing = $true; TimeoutSec = 25 }
  if ($null -ne $Body) { $params['Body'] = $Body | ConvertTo-Json -Depth 6 -Compress }
  $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $parsed = Invoke-RestMethod @params
    $stopwatch.Stop()
    return @{ status = 200; json = $parsed; ms = $stopwatch.ElapsedMilliseconds }
  } catch {
    $stopwatch.Stop()
    $status = 0
    if ($PSItem.Exception.Response) { $status = [int]$PSItem.Exception.Response.StatusCode }
    return @{ status = $status; json = $null; ms = $stopwatch.ElapsedMilliseconds }
  }
}

function Show-Trace($Out, [string]$Method, [string]$Path) {
  Write-Log ("-> {0} {1}" -f $Method, $Path)
  $dataLine = ''
  if ($Out.json -and ($Out.json.PSObject.Properties['data'])) {
    $dataLine = ($Out.json.data | ConvertTo-Json -Compress -Depth 4)
  }
  $tail = ''
  if ($dataLine -ne '') { $tail = ' | ' + $dataLine.Substring(0, [Math]::Min(72, $dataLine.Length)) }
  Write-Log ("< {0} | {1} ms{2}" -f $Out.status, $Out.ms, $tail)
}

function Expect-Ok($Out, [string]$What) {
  if ($Out.status -ge 400 -or -not ($Out.json -and $Out.json.success)) {
    Assert $What $false ("status " + $Out.status)
    return $null
  }
  return $Out.json.data
}

Write-Log "client    : Windows PowerShell $($PSVersionTable.PSVersion) -- transport: Invoke-RestMethod (.NET HttpClient)"
Write-Log "identity  : default User-Agent: none unless -UserAgent is passed"
Write-Log "auth live : $Email"

try {
  # Step 0: login -> session token
  $out = Invoke-Api -Method 'POST' -Path '/api/auth/login' -Body @{ email = $Email; password = $Password }
  Show-Trace $out 'POST' '/api/auth/login'
  $session = Expect-Ok $out 'login'
  if ($null -eq $session) { throw 'login failed' }
  $Token = $session.token
  $script:Ids.token = $Token

  # Self-heal: labs left behind by crashed runs of this lang
  $out = Invoke-Api -Method 'GET' -Path '/api/databases' -Token $Token
  Show-Trace $out 'GET' '/api/databases'
  @($out.json.data.databases) | Where-Object { $_.name -like "fw-lab-$Lang-*" } | ForEach-Object {
    $staleId = $_.id
    $stale = Invoke-Api -Method 'DELETE' -Path "/api/databases/$staleId" -Token $Token
    Show-Trace $stale 'DELETE' "/api/databases/$staleId (stale lab)"
  }

  # Step 1: dedicated lab database
  $out = Invoke-Api -Method 'POST' -Path '/api/databases' -Token $Token -Body @{ name = $DbName }
  Show-Trace $out 'POST' '/api/databases'
  $database = Expect-Ok $out 'create lab database'
  $script:Ids.databaseId = $database.database.id

  # Step 2: scoped read-write API key (plaintext returned exactly once)
  $out = Invoke-Api -Method 'POST' -Path '/api/api-keys' -Token $Token -Body @{ name = "fw-$Lang-$Epoch"; databaseId = $script:Ids.databaseId; permission = 'read-write' }
  Show-Trace $out 'POST' '/api/api-keys'
  $keyData = Expect-Ok $out 'create scoped api key'
  $script:Ids.keyId = $keyData.apiKey.id
  Write-Log ("  plaintext token issued once: {0}" -f (Get-Mask $keyData.plaintext))

  $apiToken = $keyData.plaintext
  $cmdPath = "/api/data/$($script:Ids.databaseId)/command"

  function Send-Cmd([string]$Command, [object[]]$ArgList) {
    Write-Log ("^ {0} {1} | Bearer {2}" -f $Command, (ConvertTo-Json -Compress -InputObject $ArgList), (Get-Mask $apiToken))
    return Invoke-Api -Method 'POST' -Path $cmdPath -Token $apiToken -Body @{ command = $Command; args = $ArgList }
  }
  function Get-Result($OutResp) {
    if ($OutResp.json -and $OutResp.json.data) { return $OutResp.json.data.result }
    return $null
  }

  # Step 3: SET ... PX (PowerShell idiom, milliseconds)
  $out = Send-Cmd 'SET' @($Key, $Payload, 'PX', 5000)
  Show-Trace $out 'POST' "$cmdPath (SET ... PX 5000)"
  $setResult = Get-Result $out
  Expect-Ok $out 'SET with PX 5000' | Out-Null
  Assert 'SET returns OK' ($setResult -eq 'OK') ($setResult | ConvertTo-Json -Compress)

  # Step 4 (bonus): pipeline - atomic batch
  $out = Invoke-Api -Method 'POST' -Path "/api/data/$($script:Ids.databaseId)/pipeline" -Token $apiToken -Body @{
    commands = @(
      @{ command = 'INCR'; args = @($HitsKey) },
      @{ command = 'INCR'; args = @($HitsKey) },
      @{ command = 'INCR'; args = @($HitsKey) }
    )
  }
  Show-Trace $out 'POST' "/api/data/$($script:Ids.databaseId)/pipeline (INCR x3)"
  $pipeData = Expect-Ok $out 'pipeline executes'
  $pipeResults = @()
  if ($pipeData -and $pipeData.results) { $pipeResults = @($pipeData.results | ForEach-Object { $_.result }) }
  $pipeOk = ($pipeResults.Count -eq 3) -and ($pipeResults[0] -eq 1) -and ($pipeResults[1] -eq 2) -and ($pipeResults[2] -eq 3)
  Assert 'pipeline INCR x3 -> [1,2,3]' $pipeOk (($pipeResults | ConvertTo-Json -Compress))

  # Step 5: round trip
  $out = Send-Cmd 'GET' @($Key)
  Show-Trace $out 'POST' "$cmdPath (GET)"
  $saved = Get-Result $out
  Assert 'value round-trips byte-for-byte' ($saved -ceq $Payload) ($saved | ConvertTo-Json -Compress)

  # Step 6/7: TTL + EXISTS while alive
  $out = Send-Cmd 'TTL' @($Key)
  Show-Trace $out 'POST' "$cmdPath (TTL)"
  $ttl = Get-Result $out
  Assert 'TTL counts down 5->1' ($ttl -ge 1 -and $ttl -le 5) "TTL $ttl"

  $out = Send-Cmd 'EXISTS' @($Key)
  Show-Trace $out 'POST' "$cmdPath (EXISTS)"
  $exists = Get-Result $out
  Assert 'EXISTS is 1 before expiry' ($exists -eq 1) "EXISTS $exists"

  # Step 8: wait past expiry
  Write-Log '...waiting 6.5 s for the key to expire...'
  Start-Sleep -Milliseconds 6500

  # Step 9/10: proof of expiry
  $out = Send-Cmd 'GET' @($Key)
  Show-Trace $out 'POST' "$cmdPath (GET after expiry)"
  $after = Get-Result $out
  Assert 'expired key reads as Redis nil (JSON null)' ($null -eq $after) ($after | ConvertTo-Json -Compress)

  $out = Send-Cmd 'TTL' @($Key)
  Show-Trace $out 'POST' "$cmdPath (TTL after expiry)"
  $ttlAfter = Get-Result $out
  Assert 'TTL on expired key is -2 (no such key)' ($ttlAfter -eq -2) "TTL $ttlAfter"

  # Step 11: revoke, prove rejection
  $out = Invoke-Api -Method 'DELETE' -Path "/api/api-keys/$($script:Ids.keyId)" -Token $Token
  Show-Trace $out 'DELETE' "/api/api-keys/$($script:Ids.keyId) (revoke)"
  Expect-Ok $out 'revoke api key' | Out-Null
  $rejected = Send-Cmd 'GET' @($Key)
  Show-Trace $rejected 'POST' "$cmdPath (revoked token)"
  Assert 'revoked key is rejected 401' ($rejected.status -eq 401) ("status " + $rejected.status)
} finally {
  if ($script:Ids.databaseId) {
    $out = Invoke-Api -Method 'DELETE' -Path "/api/databases/$($script:Ids.databaseId)" -Token $script:Ids.token
    Show-Trace $out 'DELETE' "/api/databases/$($script:Ids.databaseId) (teardown)"
    Assert 'lab database deleted with scoped keys' ($out.status -eq 200) ("status " + $out.status)
  }
  $verdict = if ($script:Failures -eq 0) { 'ALL PASS' } else { 'FAILURES' }
  Write-Log ("{0} -- {1}/{2} checks" -f $verdict, ($script:Checks - $script:Failures), $script:Checks)
  Write-Log ''
}
if ($script:Failures -eq 0) { exit 0 } else { exit 1 }
