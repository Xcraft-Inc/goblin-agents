// @ts-check
const path = require('node:path');
const fse = require('fs-extra');
const {string, Sculpt, dateTime, object} = require('xcraft-core-stones');
const xConfig = require('xcraft-core-etc')().load('xcraft');

class MessageShape {
  timestamp = dateTime;
  step = string;
  payload = object;
}

class Message extends Sculpt(MessageShape) {}

class Logger {
  #id;

  /** @type {Set<Message>} */
  #messages = new Set();

  /** @type {Map<string, Logger>} */
  static #loggers = new Map();
  static #logDir = path.join(xConfig.xcraftRoot, 'var/log/ai');

  constructor(id) {
    this.#id = id;
    fse.ensureDirSync(Logger.#logDir);
    Logger.#loggers.set(id, this);
  }

  /**
   * @param {string} step
   * @param {object} payload
   */
  push(step, payload) {
    const timestamp = new Date().toISOString();
    const msg = new Message({timestamp, step, payload});
    this.#messages.add(msg);
  }

  async #report() {
    let timestamp = new Date().toISOString();
    let messages = '';

    for (const message of this.#messages) {
      timestamp = message.timestamp;

      const messageFile = path.join(__dirname, 'report/message.html');
      let reportMessage = await fse.readFile(messageFile, 'utf8');

      let payload = '';
      for (const [key, value] of Object.entries(message.payload)) {
        const itemFile = path.join(__dirname, 'report/item.html');
        let reportItem = await fse.readFile(itemFile, 'utf8');
        payload += reportItem
          .replace('${KEY}', key)
          .replace('${VALUE}', `${value}`.replaceAll('\n', '<br/>'));
      }

      messages += reportMessage
        .replace('${TIMESTAMP}', message.timestamp)
        .replace('${STEP}', message.step)
        .replace('${PAYLOAD}', payload);
    }

    const reportFile = path.join(__dirname, 'report/report.html');
    let report = await fse.readFile(reportFile, 'utf8');
    report = report
      .replace('${MESSAGES}', messages)
      .replace('${TITLE}', `AI reporting for ${this.#id}`);

    const ts = timestamp.split(':').slice(0, 2).join('').split('-').join('');
    const reportOutput = path.join(Logger.#logDir, `${this.#id}_${ts}Z.html`);
    await fse.writeFile(reportOutput, report, 'utf8');
  }

  async dispose() {
    if (this.#id && this.#id !== 'default') {
      await this.#report();
    }
    Logger.#loggers.delete(this.#id);
  }

  static get(id, quest) {
    if (quest.quest) {
      quest = quest.quest;
    }
    if (Logger.#loggers.has(id)) {
      const logger = Logger.#loggers.get(id);
      if (logger) {
        return logger;
      }
    }
    const logger = new Logger(id);
    quest.defer(async () => await logger.dispose());
    return logger;
  }

  static get logDir() {
    return Logger.#logDir;
  }
}

module.exports = Logger;
