// Copyright 2019 ODK Central Developers
// See the NOTICE file at the top-level directory of this distribution and at
// https://github.com/getodk/central-backend/blob/master/NOTICE.
// This file is part of ODK Central. It is subject to the license terms in
// the LICENSE file found in the top-level directory of this distribution and at
// https://www.apache.org/licenses/LICENSE-2.0. No part of ODK Central,
// including this file, may be copied, modified, propagated, or distributed
// except according to the terms contained in the LICENSE file.

const { Transform, pipeline } = require('stream');
const parse = require('csv-parse');
const csv = require('csv-stringify');
const sanitize = require('sanitize-filename');
const { zipPart } = require('../util/zip');

const headers = [ 'event', 'node', 'start', 'end', 'latitude', 'longitude', 'accuracy', 'old-value', 'new-value' ];

// used by parseClientAudits below.
const parseOptions = { bom: true, trim: true, skipEmptyLines: true };
const headerLookup = {};
for (const header of headers) headerLookup[header] = true;

// take in a csv buffer, return:
// Promise[Array[{ ...auditFields, remainder: { ...unknownFields } }]]
// in an even more ideal world we'd take a csv stream rather than a buffer. but
// typically we're getting things things back from the database, and they come in
// buffer form. one might have an urge to then turn the buffer into a stream and
// pipe it to the csv parser, but that's already what it does internally.
//
// TODO: if the csv is ragged our behaviour is somewhat undefined.
const parseClientAudits = (buffer) => {
  const parser = parse(buffer, parseOptions);
  const audits = [];

  parser.once('data', (header) => {
    // do some preprocessing on the header row so we know how to sort the actual rows.
    const names = [];
    const known = [];
    for (let idx = 0; idx < header.length; idx += 1) {
      const name = header[idx];
      names.push(name);
      known.push(headerLookup[name] === true);
    }

    // and now set ourselves up to actually process each cell of each row.
    parser.on('data', (row) => {
      const audit = { remainder: {} };
      audits.push(audit);
      for (let idx = 0; (idx < row.length) && (idx < names.length); idx += 1)
        (known[idx] ? audit : audit.remainder)[names[idx]] = row[idx];
    });
  });

  return new Promise((pass, fail) => {
    parser.on('error', fail);
    parser.on('end', () => { pass(audits); });
  });
};

// helper for streamClientAudits below.
const formatRow = (row) => {
  const out = [];
  for (const header of headers) out.push(row[header]);
  return out;
};

// take in database rowstream of client audits; return agglomerated csv zippart.
const streamClientAudits = (inStream, form) => {
  const archive = zipPart();

  let first = true;
  const csvifier = new Transform({
    objectMode: true,
    transform(data, _, done) {
      // TODO: we do not currently try/catch this block because it feels low risk.
      // this may not actually be the case..
      if (first === true) {
        archive.append(outStream, { name: sanitize(`${form.xmlFormId} - audit.csv`) }); // eslint-disable-line no-use-before-define
        archive.finalize();
        this.push(headers);
        first = false;
      }

      if (data.content != null) {
        parseClientAudits(data.content)
          .then((rows) => {
            for (const row of rows) this.push(formatRow(row));
            done();
          })
          .catch(done);
      } else {
        done(null, formatRow(data));
      }
    }, flush(done) {
      archive.finalize(); // finalize without attaching a zip if no rows came back.
      done();
    }
  });

  // only appended (above, in transform()) if data comes in.
  const outStream = pipeline(inStream, csvifier, csv(), (err) => {
    if (err != null) archive.error(err);
  });
  return archive;
};

module.exports = { headers, parseClientAudits, streamClientAudits };

