# Framework client baseline - cURL.exe
# Transport: raw curl.exe per request (the shell as the client; every header built by hand).
# Shared scenario with the other clients: see tests/clients/README.md.
# Expiry idiom for this client: SET, then a second request EXPIRE key <seconds> (two-step).
# Output note: ASCII-only log lines (PowerShell 5.1 reads BOM-less scripts as ANSI).
$ErrorActionPreference = 'Stop'
$Base = if ($env:RH_BASE_URL) { $env:RH_BASE_URL.TrimEnd('/') } else { 'http://127.0.0.1:3000' }
$Email = 'qa-review@redishost.test'
$Password = 'review-pass-77'

$Lang = 'curl'
$Epoch = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$DbName = "fw-lab-$Lang-$Epoch"
$Key = "fw:$Lang`:session"
$Payload = '{"lang":"curl","saved":"baseline","note":"framework TTL test"}'

$script:Checks = 0
$script:Failures = 0
$script:Ids = @{}
$script:TmpFiles = @()

function Write-Log([string]$Line) { Write-Host $Line }
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
  param([string]$Method, [string]$Path, [string]$Token, [string]$BodyJson)
  $curlArgs = New-Object 'System.Collections.Generic.List[string]'
  [void]$curlArgs.Add('-sS')
  [void]$curlArgs.Add('-X')
  [void]$curlArgs.Add($Method)
  $displayAuth = ''
  if ($Token) {
    $displayAuth = ' -H "Authorization: Bearer ' + (Get-Mask $Token) + '"'
    [void]$curlArgs.Add('-H')
    [void]$curlArgs.Add("Authorization: Bearer $Token")
  }
  $displayBody = ''
  $outFile = Join-Path $env:TEMP ("fw-curl-{0}-{1}.resp" -f $script:Epoch, $script:TmpFiles.Count)
  $script:TmpFiles += $outFile
  if ($BodyJson) {
    $bodyFile = Join-Path $env:TEMP ("fw-curl-{0}-{1}.body" -f $script:Epoch, $script:TmpFiles.Count)
    $utf8NoBom = New-Object 'System.Text.UTF8Encoding'($false)
    [System.IO.File]::WriteAllText($bodyFile, $BodyJson, $utf8NoBom)
    $script:TmpFiles += $bodyFile
    $displayBody = ' -H "Content-Type: application/json" --data-binary @body-file'
    [void]$curlArgs.Add('-H')
    [void]$curlArgs.Add('Content-Type: application/json')
    [void]$curlArgs.Add('--data-binary')
    [void]$curlArgs.Add("@$bodyFile")
  }
  [void]$curlArgs.Add('-o')
  [void]$curlArgs.Add($outFile)
  [void]$curlArgs.Add('-w')
  [void]$curlArgs.Add('%{http_code}')
  [void]$curlArgs.Add("$Base$Path")

  # The request line, exactly as cURL sends it (token masked for the log).
  Write-Log ("-> {0} {1}" -f $Method, $Path)
  Write-Log ("   curl.exe -X {0}{1}{2}" -f $Method, $displayAuth, $displayBody)

  $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
  $code = (& curl.exe $curlArgs.ToArray()) -join ''
  $stopwatch.Stop()
  $status = 0
  [void][int]::TryParse($code, [ref]$status)
  $parsed = $null
  if (Test-Path $outFile) {
    $raw = Get-Content $outFile -Raw
    if ($raw) { $parsed = $raw | ConvertFrom-Json }
  }
  return @{ status = $status; json = $parsed; ms = $stopwatch.ElapsedMilliseconds }
}

function Show-Trace($Out, [string]$Method, [string]$Path) {
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

Write-Log "client    : cURL on Windows -- transport: curl.exe, one process per request"
Write-Log "identity  : default User-Agent: curl/<version>"
Write-Log "auth live : $Email"

try {
  # Step 0: login -> session token
  $out = Invoke-Api -Method 'POST' -Path '/api/auth/login' -BodyJson ('{"email":"' + $Email + '","password":"' + $Password + '"}')
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
  $out = Invoke-Api -Method 'POST' -Path '/api/databases' -Token $Token -BodyJson ('{"name":"' + $DbName + '"}')
  Show-Trace $out 'POST' '/api/databases'
  $database = Expect-Ok $out 'create lab database'
  $script:Ids.databaseId = $database.database.id

  # Step 2: scoped read-write API key (plaintext returned exactly once)
  $createKeyJson = '{"name":"fw-curl-' + $Epoch + '","databaseId":"' + $script:Ids.databaseId + '","permission":"read-write"}'
  $out = Invoke-Api -Method 'POST' -Path '/api/api-keys' -Token $Token -BodyJson $createKeyJson
  Show-Trace $out 'POST' '/api/api-keys'
  $keyData = Expect-Ok $out 'create scoped api key'
  $script:Ids.keyId = $keyData.apiKey.id
  Write-Log ("  plaintext token issued once: {0}" -f (Get-Mask $keyData.plaintext))

  $apiToken = $keyData.plaintext
  $cmdPath = "/api/data/$($script:Ids.databaseId)/command"

  function Send-CommandJson([string]$Json, [string]$What) {
    Write-Log ("^ POST {0} | Bearer {1}" -f $What, (Get-Mask $apiToken))
    return Invoke-Api -Method 'POST' -Path $cmdPath -Token $apiToken -BodyJson $Json
  }

  function New-CommandBody([string]$Command, [object[]]$ArgList) {
    return (@{ command = $Command; args = $ArgList } | ConvertTo-Json -Compress -Depth 4)
  }
  function New-PipelineBody([object[]]$Commands) {
    return (@{ commands = $Commands } | ConvertTo-Json -Compress -Depth 5)
  }

  # Step 3a: SET (no TTL yet - curl baseline shows the two-step path)
  $out = Send-CommandJson (New-CommandBody 'SET' @($Key, $Payload)) 'SET'
  Show-Trace $out 'POST' "$cmdPath (SET)"
  $setResult = $out.json.data.result
  Expect-Ok $out 'SET stored value' | Out-Null
  Assert 'SET returns OK' ($setResult -eq 'OK') ($setResult | ConvertTo-Json -Compress)

  # Step 3b: EXPIRE - a separate request (the raw-REST way to add expiry)
  $out = Send-CommandJson (New-CommandBody 'EXPIRE' @($Key, 5)) 'EXPIRE 5'
  Show-Trace $out 'POST' "$cmdPath (EXPIRE 5)"
  $expireResult = $out.json.data.result
  Expect-Ok $out 'EXPIRE applied' | Out-Null
  Assert 'EXPIRE returns 1 (TTL set)' ($expireResult -eq 1) ($expireResult | ConvertTo-Json -Compress)

  # Step 4 (bonus): pipeline - atomic batch
  $hits = "fw:$Lang`:hits"
  $inCrArgs = @(
    @{ command = 'INCR'; args = @($hits) },
    @{ command = 'INCR'; args = @($hits) },
    @{ command = 'INCR'; args = @($hits) }
  )
  $out = Invoke-Api -Method 'POST' -Path "/api/data/$($script:Ids.databaseId)/pipeline" -Token $apiToken -BodyJson (New-PipelineBody $inCrArgs)
  Show-Trace $out 'POST' "/api/data/$($script:Ids.databaseId)/pipeline (INCR x3)"
  $pipeData = Expect-Ok $out 'pipeline executes'
  $pipeResults = @()
  if ($pipeData -and $pipeData.results) { $pipeResults = @($pipeData.results | ForEach-Object { $_.result }) }
  $pipeOk = ($pipeResults.Count -eq 3) -and ($pipeResults[0] -eq 1) -and ($pipeResults[1] -eq 2) -and ($pipeResults[2] -eq 3)
  Assert 'pipeline INCR x3 -> [1,2,3]' $pipeOk (($pipeResults | ConvertTo-Json -Compress))

  # Step 5: round trip
  $out = Send-CommandJson (New-CommandBody 'GET' @($Key)) 'GET'
  Show-Trace $out 'POST' "$cmdPath (GET)"
  $saved = $out.json.data.result
  Expect-Ok $out 'GET round trip' | Out-Null
  Assert 'value round-trips byte-for-byte' ($saved -ceq $Payload) ($saved | ConvertTo-Json -Compress)

  # Step 6/7: TTL + EXISTS while alive
  $out = Send-CommandJson (New-CommandBody 'TTL' @($Key)) 'TTL'
  Show-Trace $out 'POST' "$cmdPath (TTL)"
  $ttl = $out.json.data.result
  Expect-Ok $out 'TTL probe' | Out-Null
  Assert 'TTL counts down 5->1' ($ttl -ge 1 -and $ttl -le 5) "TTL $ttl"

  $out = Send-CommandJson (New-CommandBody 'EXISTS' @($Key)) 'EXISTS'
  Show-Trace $out 'POST' "$cmdPath (EXISTS)"
  $exists = $out.json.data.result
  Expect-Ok $out 'EXISTS probe' | Out-Null
  Assert 'EXISTS is 1 before expiry' ($exists -eq 1) "EXISTS $exists"

  # Step 8: wait past expiry
  Write-Log '...waiting 6.5 s for the key to expire...'
  Start-Sleep -Milliseconds 6500

  # Step 9/10: proof of expiry
  $out = Send-CommandJson (New-CommandBody 'GET' @($Key)) 'GET after expiry'
  Show-Trace $out 'POST' "$cmdPath (GET after expiry)"
  $after = $out.json.data.result
  Expect-Ok $out 'GET after expiry' | Out-Null
  Assert 'expired key reads as Redis nil (JSON null)' ($null -eq $after) ($after | ConvertTo-Json -Compress)

  $out = Send-CommandJson (New-CommandBody 'TTL' @($Key)) 'TTL after expiry'
  Show-Trace $out 'POST' "$cmdPath (TTL after expiry)"
  $ttlAfter = $out.json.data.result
  Expect-Ok $out 'TTL after expiry' | Out-Null
  Assert 'TTL on expired key is -2 (no such key)' ($ttlAfter -eq -2) "TTL $ttlAfter"

  # Step 11: revoke, prove rejection
  $out = Invoke-Api -Method 'DELETE' -Path "/api/api-keys/$($script:Ids.keyId)" -Token $Token
  Show-Trace $out 'DELETE' "/api/api-keys/$($script:Ids.keyId) (revoke)"
  Expect-Ok $out 'revoke api key' | Out-Null
  $rejected = Send-CommandJson (New-CommandBody 'GET' @($Key)) 'GET with revoked token'
  Show-Trace $rejected 'POST' "$cmdPath (revoked token)"
  Assert 'revoked key is rejected 401' ($rejected.status -eq 401) ("status " + $rejected.status)
} finally {
  if ($script:Ids.databaseId) {
    $out = Invoke-Api -Method 'DELETE' -Path "/api/databases/$($script:Ids.databaseId)" -Token $script:Ids.token
    Show-Trace $out 'DELETE' "/api/databases/$($script:Ids.databaseId) (teardown)"
    Assert 'lab database deleted with scoped keys' ($out.status -eq 200) ("status " + $out.status)
  }
  foreach ($tmp in $script:TmpFiles) { Remove-Item $tmp -ErrorAction SilentlyContinue | Out-Null }
  $verdict = if ($script:Failures -eq 0) { 'ALL PASS' } else { 'FAILURES' }
  Write-Log ("{0} -- {1}/{2} checks" -f $verdict, ($script:Checks - $script:Failures), $script:Checks)
  Write-Log ''
}
if ($script:Failures -eq 0) { exit 0 } else { exit 1 }
