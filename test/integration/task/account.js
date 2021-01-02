const appRoot = require('app-root-path');
const should = require('should');
const { testTask } = require('../setup');
const { getOrNotFound } = require(appRoot + '/lib/util/promise');
const { createUser, promoteUser, setUserPassword } = require(appRoot + '/lib/task/account');

describe('task: accounts', () => {
  describe('createUser', () => {
    it('should create a user account', testTask(({ User }) =>
      createUser('testuser@getodk.org', 'aoeu')
        .then((result) => {
          result.email.should.equal('testuser@getodk.org');
          return User.getByEmail('testuser@getodk.org')
            .then((user) => user.isDefined().should.equal(true));
        })));

    it('should log an audit entry', testTask(({ Audit, User }) =>
      createUser('testuser@getodk.org', 'aoeu')
        .then((result) => Promise.all([
          User.getByEmail('testuser@getodk.org').then((o) => o.get()),
          Audit.getLatestWhere({ action: 'user.create' }).then((o) => o.get())
        ]))
        .then(([ user, log ]) => {
          log.acteeId.should.equal(user.actor.acteeId);
          log.details.data.email.should.equal(user.email);
          log.details.odkcmd.should.equal(true);
        })));
  });

  describe('promoteUser', () => {
    // TODO: for now, we simply check if the user can create a nonexistent actee
    // species to verify the */* grant. eventually we should be more precise.
    it('should promote a user account to admin', testTask(({ Actee, User }) =>
      User.fromApi({ email: 'testuser@getodk.org', displayName: 'test user' }).create()
        .then((user) => user.actor.can('user.create', User.species()))
        .then((allowed) => {
          allowed.should.equal(false);
          return promoteUser('testuser@getodk.org')
            .then(() => User.getByEmail('testuser@getodk.org')
              .then(getOrNotFound)
              .then((user) => user.actor.can('user.create', User.species()))
              .then((allowed) => allowed.should.equal(true)));
        })));

    it('should log an audit entry', testTask(({ Audit, Role, User }) =>
      User.fromApi({ email: 'testuser@getodk.org', displayName: 'test user' }).create()
        .then((user) => promoteUser('testuser@getodk.org')
          .then(() => Promise.all([
            Audit.getLatestWhere({ action: 'assignment.create' }).then((o) => o.get()),
            Role.getBySystemName('admin').then((o) => o.get())
          ]))
          .then(([ log, role ]) => {
            log.acteeId.should.equal(user.actor.acteeId);
            log.details.roleId.should.equal(role.id);
            log.details.grantedActeeId.should.equal('*');
            log.details.odkcmd.should.equal(true);
          }))));
  });

  describe('setUserPassword', () => {
    it('should set a user password', testTask(({ User, crypto }) =>
      User.fromApi({ email: 'testuser@getodk.org', displayName: 'test user' }).create()
        .then(() => setUserPassword('testuser@getodk.org', 'aoeu'))
        .then(() => User.getByEmail('testuser@getodk.org'))
        .then(getOrNotFound)
        .then((user) => crypto.verifyPassword('aoeu', user.password))
        .then((verified) => verified.should.equal(true))));

    it('should log an audit entry', testTask(({ Audit, User, crypto }) =>
      User.fromApi({ email: 'testuser@getodk.org', displayName: 'test user' }).create()
        .then(() => setUserPassword('testuser@getodk.org', 'aoeu'))
        .then(() => Promise.all([
          Audit.getLatestWhere({ action: 'user.update' }).then((o) => o.get()),
          User.getByEmail('testuser@getodk.org').then((o) => o.get())
        ])
        .then(([ log, user ]) => {
          log.acteeId.should.equal(user.actor.acteeId);
          log.details.data.should.eql({ password: true });
          log.details.odkcmd.should.equal(true);
        }))));
  });
});

