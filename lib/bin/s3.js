// Copyright 2024 ODK Central Developers
// See the NOTICE file at the top-level directory of this distribution and at
// https://github.com/getodk/central-backend/blob/master/NOTICE.
// This file is part of ODK Central. It is subject to the license terms in
// the LICENSE file found in the top-level directory of this distribution and at
// https://www.apache.org/licenses/LICENSE-2.0. No part of ODK Central,
// including this file, may be copied, modified, propagated, or distributed
// except according to the terms contained in the LICENSE file.

const { program, Argument } = require('commander');

const { getCount, setFailedToPending, uploadPending } = require('../task/s3');

program.command('count-blobs')
  .addArgument(new Argument('status').choices(['pending', 'in_progress', 'uploaded', 'failed']))
  .action(getCount);
program.command('reset-failed-to-pending').action(setFailedToPending);
program.command('upload-pending').action(uploadPending);
program.parse();
