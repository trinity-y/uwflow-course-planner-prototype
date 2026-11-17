import React, { ButtonHTMLAttributes } from 'react';

import Tooltip from 'components/display/Tooltip';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

const ActionButton = ({
  label,
  children,
  type = 'button',
  ...props
}: Props) => (
  <Tooltip content={label}>
    <button {...props} type={type} aria-label={label} title="">
      {children}
    </button>
  </Tooltip>
);

export default ActionButton;
