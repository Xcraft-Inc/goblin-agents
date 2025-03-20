'use strict';

const path = require('node:path');
const fse = require('fs-extra');

module.exports = [
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
