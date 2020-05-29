import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faBan } from '@fortawesome/pro-light-svg-icons';

export const NotificationContainer = styled.div`
  position: fixed;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 999;
  
  pointer-events: none;
  
  top: 4rem;
  left: 4rem;
  right: 4rem;

`
const SeverityColors = {
  warning: "#FFF569",
  error: "#EC4343",
  info: "#2C2F33"
}

const SeverityIcons = {
  error: faBan,
  warning: faExclamationTriangle,
  info: null
}

export enum Severity {
  warning = "warning",
  error = "error",
  info = "info"
}

export const Notification = styled(({ children, severity, ...rest }) => (
  <motion.div {...rest}>{SeverityIcons[severity] && <Icon icon={SeverityIcons[severity]} />}{children}</motion.div>
))<{ severity: Severity }>`
  padding: 2rem 5rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  background-color: ${p => SeverityColors[p.severity || "info"]};
  
  display: flex;
  align-items: center;

  box-shadow: 4px 4px 10px 2px rgba(0,0,0,.5);
  font-size: 2rem;
  svg {
    font-size: 2rem;
    margin-right: 1.5rem;
  }
`