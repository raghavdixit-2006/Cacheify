'use client';

/** Back-to-home button for the manual page footer. */

import { Button } from '../common/atoms.jsx';
import { navigate } from '../../router/navigate.js';

export default function BackHomeButton() {
  return (
    <Button
      label="Back to home"
      iconName="arrow-left"
      variant="ghost"
      onClick={() => navigate('/')}
    />
  );
}
