// Copyright 2019 ODK Central Developers
// See the NOTICE file at the top-level directory of this distribution and at
// https://github.com/getodk/central-backend/blob/master/NOTICE.
// This file is part of ODK Central. It is subject to the license terms in
// the LICENSE file found in the top-level directory of this distribution and at
// https://www.apache.org/licenses/LICENSE-2.0. No part of ODK Central,
// including this file, may be copied, modified, propagated, or distributed
// except according to the terms contained in the LICENSE file.


// This migration permanently purges all forms that were previously marked as deleted.
// This is part of a central-backend update (1.4) that allows listing and restoring deleted
// forms, but since there was no way to access forms deleted prior to this release, we
// are removing old deleted forms.

// Purging steps
// 1. Redact notes about forms from the audit table that reference a form
//    (includes one kind of comment on a submission)
// 2. Log the purge in the audit log with actor not set because purging isn't accessible through the api
// 3. Update actees table for the specific form to leave some useful information behind
// 4. Delete the forms and their resources from the database
// 5. Purge unattached blobs


const up = (db) =>
  db.raw(`
update audits set notes = ''
from forms
where audits."acteeId" = forms."acteeId"
and forms."deletedAt" is not null`)
    .then(() => db.raw(`
insert into audits ("action", "acteeId", "loggedAt")
select 'form.purge', "acteeId",  clock_timestamp()
from forms
where forms."deletedAt" is not null`))
    .then(() => db.raw(`
update actees set "purgedAt" = clock_timestamp(),
  "purgedName" = form_defs."name",
  "details" = json_build_object('projectId', forms."projectId",
                                'formId', forms.id,
                                'xmlFormId', forms."xmlFormId",
                                'deletedAt', forms."deletedAt",
                                'version', form_defs."version")
from forms
left outer join form_defs on forms."currentDefId" = form_defs.id
where actees.id = forms."acteeId"
and forms."deletedAt" is not null`))
    .then(() => db.raw(`
delete from forms
where forms."deletedAt" is not null`))
    .then(() => db.raw(`
delete from blobs
  using blobs as b
  left join client_audits as ca on ca."blobId" = b.id
  left join submission_attachments as sa on sa."blobId" = b.id
  left join form_attachments as fa on fa."blobId" = b.id
where (blobs.id = b.id and
  ca."blobId" is null and
  sa."blobId" is null and
  fa."blobId" is null)`));

const down = () => {};

module.exports = { up, down };
