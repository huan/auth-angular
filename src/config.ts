export const STORAGE_KEY = {
  ACCESS_TOKEN:   'access_token',
  ID_TOKEN:       'id_token',
  USER_PROFILE:   'user_profile',
  /**
   * OIDC-conformant refresh tokens: https://auth0.com/docs/api-auth/tutorials/adoption/refresh-tokens
   * Silent Authentication: https://auth0.com/docs/api-auth/tutorials/silent-authentication
   */
  REFRESH_TOKEN:  'refresh_token',
}

export const VERSION: string = require('../package.json')['version']
