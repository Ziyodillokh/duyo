import React from 'react';
import { cn } from '../../lib/utils';

/**
 * The DUYO robot as a brand mark — the same render the landing page and the
 * admin panel use, so all three surfaces open with one identity.
 *
 * This is NOT a replacement for DuyoAvatar. The avatar is the character: it
 * carries eleven states and reacts to what is happening in the app. This is a
 * still image for the moments where DUYO is being introduced rather than
 * reacting — splash and language pick, before there is anything to react to.
 */
export const DuyoLogo: React.FC<{ className?: string }> = ({ className }) => (
  <img
    src="/duyo-logo.png"
    alt=""
    aria-hidden="true"
    className={cn('object-contain', className)}
  />
);
