/*
* The copyright in this software is being made available under the BSD License, included below.
*
* Copyright (c) 2022, NHK(Japan Broadcasting Corporation).
* All rights reserved.
*
* Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
* - Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
* - Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
* - Neither the name of the NHK nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
*
* THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/**
 * Launch the sample player
 */
const path = require('path');
const open = require('open');
const colors = require('colors');
const express = require('express');
const { program } = require('commander');

// CLI
program
  .option('-u, --url <URL>', 'Add MPD URL.')
  .option(
    '-m, --mode <default | ttml >',
    'Select sample player mode.'
  )
  .option('-p, --port <number>', 'Change the port number.', parseInt)
  .parse(process.argv);
const options = program.opts();

console.info(options);
colors.setTheme({
  debug: 'blue',
  warn: 'yellow',
  info: 'green',
  error: 'red',
});

const isUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch (_) {
    console.warn('[WARN] invalid MPD URL ==> %s'.warn, url);
    return false;
  }
};
const PORT = options.port || 8080;
const ROOT_DIR = path.resolve(__dirname, '../../');
const PLAYER_BASE_URL = `http://localhost:${PORT}/samples`;
const playerMode = options.mode || 'default';
const mpdUrl = isUrl(options.url) ? encodeURIComponent(options.url) : '';
const toPlayerUrl = (html) => (url) =>
  `${PLAYER_BASE_URL}/${html}${url ? `?url=${url}` : ''}`;
const defaultPlayerUrl = toPlayerUrl('player.html')(mpdUrl);
const ttmlPlayerUrl = toPlayerUrl('player_ttml.html')(mpdUrl);

const app = express();
app.use('/samples', express.static(`${ROOT_DIR}/samples`));
app.use('/dist', express.static(`${ROOT_DIR}/dist`));

app.listen(PORT, () => {
  console.log('\nListening on port %s ...\n'.info, PORT);

  switch (playerMode) {
    case 'ttml':
      open(ttmlPlayerUrl);
      break;
    default:
      open(defaultPlayerUrl);
      break;
  }
});

console.info('[default] '.info + defaultPlayerUrl.debug);
console.info('[ttml] '.info + ttmlPlayerUrl.debug);
