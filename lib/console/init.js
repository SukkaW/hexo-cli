'use strict';

const Promise = require('bluebird');
const { join, resolve } = require('path');
const chalk = require('chalk');
const { exists, rmdir, unlink, copyDir, readdir, stat } = require('hexo-fs');
const tildify = require('tildify');
const { spawn } = require('hexo-util');
const commandExistsSync = require('command-exists').sync;

const ASSET_DIR = join(__dirname, '../../assets');
const GIT_REPO_URL = 'https://github.com/hexojs/hexo-starter.git';

async function initConsole(args) {
  args = Object.assign({ install: true, clone: true }, args);

  const baseDir = this.base_dir;
  const target = args._[0] ? resolve(baseDir, args._[0]) : baseDir;
  const { log } = this;

  if (await exists(target) && (await readdir(target)).length !== 0) {
    log.fatal(`${chalk.magenta(tildify(target))} not empty, please run \`hexo init\` on an empty folder and then copy your files into it`);
    await Promise.reject(new Error('target not empty'));
  }

  log.info('Cloning hexo-starter', GIT_REPO_URL);

  if (args.clone) {
    try {
      await spawn('git', ['clone', '--recurse-submodules', '--depth=1', '--quiet', GIT_REPO_URL, target], {
        stdio: 'inherit'
      });
    } catch (err) {
      log.warn('git clone failed. Copying data instead');
      await copyAsset(target);
    }
  } else {
    await copyAsset(target);
  }

  await Promise.all([
    removeGitDir(target),
    removeGitModules(target)
  ]);
  if (!args.install) return;

  log.info('Install dependencies');

  let npmCommand = 'npm';
  if (commandExistsSync('yarn')) {
    npmCommand = 'yarn';
  } else if (commandExistsSync('pnpm')) {
    npmCommand = 'pnpm';
  }

  try {
    if (npmCommand === 'yarn') {
      const yarnVer = await spawn(npmCommand, ['--version'], {
        cwd: target
      });
      if (typeof yarnVer === 'string' && yarnVer.startsWith('1')) {
        await spawn(npmCommand, ['install', '--production', '--ignore-optional', '--silent'], {
          cwd: target,
          stdio: 'inherit'
        });
      } else {
        npmCommand = 'npm';
      }
    } else if (npmCommand === 'pnpm') {
      await spawn(npmCommand, ['install', '--prod', '--no-optional', '--silent'], {
        cwd: target,
        stdio: 'inherit'
      });
    }

    if (npmCommand === 'npm') {
      await spawn(npmCommand, ['install', '--only=production', '--optional=false', '--silent'], {
        cwd: target,
        stdio: 'inherit'
      });
    }
    log.info('Start blogging with Hexo!');
  } catch (err) {
    log.warn(`Failed to install dependencies. Please run 'npm install' in "${target}" folder.`);
  }
}

async function copyAsset(target) {
  await copyDir(ASSET_DIR, target, { ignoreHidden: false });
}

async function removeGitDir(target) {
  const gitDir = join(target, '.git');
  let stats;

  try {
    stats = stat(gitDir);
  } catch (err) {
    if (err && err.code === 'ENOENT') return;
    throw err;
  }

  if (stats && stats.isDirectory()) {
    await rmdir(gitDir);
  } else {
    await unlink(gitDir);
  }

  const paths = await readdir(target);

  const gitDirToBeCheckedAndRemoved = paths
    .map(path => join(target, path))
    .filter(async path => {
      const stats = await stat(path);
      return stats.isDirectory();
    });

  gitDirToBeCheckedAndRemoved.forEach(removeGitDir);
}

async function removeGitModules(target) {
  try {
    await unlink(join(target, '.gitmodules'));
  } catch (err) {
    if (err && err.code === 'ENOENT') return;
    throw err;
  }
}

module.exports = initConsole;
