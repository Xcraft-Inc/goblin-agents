'use strict';

module.exports = [
  {
    type: 'input',
    name: 'version',
    message: 'Agents version',
    default: 2,
  },
  {
    type: 'input',
    name: 'defaultProfile',
    message: 'Agents default profile',
    default: null,
  },
  {
    type: 'input',
    name: 'defaultSettings',
    message: 'Agents default setting',
    default: null,
  },
  {
    type: 'input',
    name: 'profiles',
    message: 'Agents profiles for overriding settings',
    default: {},
  },
  {
    type: 'input',
    name: 'settings',
    message: 'Settings by name',
    default: {},
  },
];
