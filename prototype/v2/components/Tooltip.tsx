import React, { ReactChild, ReactElement } from 'react';
import Tippy from '@tippyjs/react';

import 'tippy.js/dist/tippy.css';

const Tooltip = ({
  children,
  content,
}: {
  children: ReactElement;
  content: ReactChild;
}) => (
  <Tippy content={content} arrow={false} duration={[150, 50]} maxWidth={200}>
    {children}
  </Tippy>
);

export default Tooltip;
