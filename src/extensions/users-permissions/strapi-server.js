const _ = require('lodash');
const {
    contentTypes: { getNonWritableAttributes },
  } = require('@strapi/utils');

const { concat, compact, isArray } = require('lodash/fp');
const {
  validateCallbackBody,
  validateRegisterBody,
} = require('../../../node_modules/@strapi/plugin-users-permissions/server/controllers/validation/auth');
const {
  getService,
} = require('../../../node_modules/@strapi/plugin-users-permissions/server/utils');
const utils = require('@strapi/utils');
const { getAbsoluteAdminUrl, getAbsoluteServerUrl, sanitize } = utils;

const {ApplicationError, ValidationError} = utils.errors;

const sanitizeUser = (user, ctx) => {
    const { auth } = ctx.state;
    const userSchema = strapi.getModel('plugin::users-permissions.user');
  
    return sanitize.contentAPI.output(user, userSchema, { auth });
  };
module.exports = (plugin) => {
  plugin.controllers.auth.callback = async (ctx) => {
    const provider = ctx.params.provider || 'local';
    const params = ctx.request.body;

    const store = strapi.store({type: 'plugin', name: 'users-permissions'});
    const grantSettings = await store.get({key: 'grant'});

    const grantProvider = provider === 'local' ? 'email' : provider;

    if (!_.get(grantSettings, [grantProvider, 'enabled'])) {
      throw new ApplicationError('This provider is disabled');
    }

    if (provider === 'local') {
      await validateCallbackBody(params);

      const {identifier} = params;

      // Check if the user exists.
      const user = await strapi.query('plugin::users-permissions.user').findOne({
        where: {
          provider,
          $or: [{email: identifier.toLowerCase()}, {username: identifier}],
        },
        populate:{
          logo :{
            fields: ['url']
          }
        }
      });

      if (!user) {
        throw new ValidationError('Invalid username or password ');
      }

      if (!user.password) {
        throw new ValidationError('Invalid username or password');
      }

      const validPassword = await getService('user').validatePassword(
        params.password,
        user.password
      );

      if (!validPassword) {
        throw new ValidationError('Invalid username or password');
      }

      const advancedSettings = await store.get({key: 'advanced'});
      const requiresConfirmation = _.get(advancedSettings, 'email_confirmation');

      if (requiresConfirmation && user.confirmed !== true) {
        throw new ApplicationError('Your account email is not confirmed');
      }

      if (user.blocked === true) {
        throw new ApplicationError('Your account has been blocked by an administrator');
      }

      return ctx.send({
        jwt: getService('jwt').issue({id: user.id}),
        user: await sanitizeUser(user, ctx),
      });
    }

    // Connect the user with the third-party provider.
    try {
      const user = await getService('providers').connect(provider, ctx.query);

      if (user.blocked) {
        throw new ForbiddenError('Your account has been blocked by an administrator');
      }

      return ctx.send({
        jwt: getService('jwt').issue({id: user.id}),
        user: await sanitizeUser(user, ctx),
      });
    } catch (error) {
      throw new ApplicationError(error.message);
    }
  }

  plugin.controllers.auth.register = async (ctx) => {
    // This code is the default code find in node_modules/@strapi/plugin-users-permissions/server/controllers/auth.js

    const pluginStore = await strapi.store({type: 'plugin', name: 'users-permissions'});

    const settings = await pluginStore.get({key: 'advanced'});

    if (!settings.allow_register) {
      throw new ApplicationError('Register action is currently disabled');
    }

    const {register} = strapi.config.get('plugin.users-permissions');
    const alwaysAllowedKeys = ['username', 'password', 'email'];
    const userModel = strapi.contentTypes['plugin::users-permissions.user'];
    const {attributes} = userModel;

    const nonWritable = getNonWritableAttributes(userModel);

    const allowedKeys = compact(
      concat(
        alwaysAllowedKeys,
        isArray(register?.allowedFields)
          ? // Note that we do not filter allowedFields in case a user explicitly chooses to allow a private or otherwise omitted field on registration
          register.allowedFields // if null or undefined, compact will remove it
          : // to prevent breaking changes, if allowedFields is not set in config, we only remove private and known dangerous user schema fields
            // TODO V5: allowedFields defaults to [] when undefined and remove this case
          Object.keys(attributes).filter(
            (key) =>
              !nonWritable.includes(key) &&
              !attributes[key].private &&
              ![
                // many of these are included in nonWritable, but we'll list them again to be safe and since we're removing this code in v5 anyway
                // Strapi user schema fields
                'confirmed',
                'blocked',
                'confirmationToken',
                'resetPasswordToken',
                'provider',
                'id',
                'role',
                // other Strapi fields that might be added
                'createdAt',
                'updatedAt',
                'createdBy',
                'updatedBy',
                'publishedAt', // d&p
                'strapi_reviewWorkflows_stage', // review workflows
              ].includes(key)
          )
      )
    );

    const params = {
      ..._.pick(ctx.request.body, allowedKeys),
      provider: 'local',
    };

    await validateRegisterBody(params);

    const role = await strapi
      .query('plugin::users-permissions.role')
      .findOne({where: {type: settings.default_role}});

    if (!role) {
      throw new ApplicationError('Impossible to find the default role');
    }

    const {email, username, provider , nationalId} = params;
   
   
    const identifierFilter = {
      $or: [
        {email: email.toLowerCase()},
      ],
    };

    const conflictingUserCount = await strapi.query('plugin::users-permissions.user').count({
      where: {...identifierFilter, provider},
    });
    const nationalIdCount = await strapi.query('plugin::users-permissions.user').count({
      where: {nationalId},
    })
  
    if (conflictingUserCount > 0) {
      throw new ApplicationError('email already taken');
    }
    if (nationalIdCount > 0) {
      throw new ApplicationError('National ID already Registered');
    }
    
    if (settings.unique_email) {
      const conflictingUserCount = await strapi.query('plugin::users-permissions.user').count({
        where: {...identifierFilter},
      });

      if (conflictingUserCount > 0) {
        throw new ApplicationError('email already taken');
      }
    }

    const newUser = {
      ...params,
      role: role.id,
      email: email.toLowerCase(),
      username,
      confirmed: !settings.email_confirmation,
    };

    const user = await getService('user').add(newUser);

    const sanitizedUser = await sanitizeUser(user, ctx);

    if (settings.email_confirmation) {
      try {
        await getService('user').sendConfirmationEmail(sanitizedUser);
      } catch (err) {
        throw new ApplicationError(err.message);
      }

      return ctx.send({user: sanitizedUser});
    }

    const jwt = getService('jwt').issue(_.pick(user, ['id']));

    return ctx.send({
      jwt,
      user: sanitizedUser,
    });
  }

  return plugin;
}