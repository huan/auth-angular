import {
  NgModule,
}                       from '@angular/core'
import {
  JWT_OPTIONS,
  JwtModule,
  JwtModuleOptions,
}                       from '@auth0/angular-jwt'

import { Auth } from './auth'

export function jwtOptionsFactory() {
  const jwtOptions: JwtModuleOptions = {
    config: {
      tokenGetter: () => {
        return localStorage.getItem('access_token') || ''
      },
      whitelistedDomains: [
        'localhost:3001',
        'chatie.io',
      ],
      blacklistedRoutes: ['localhost:3001/auth/'],
      throwNoTokenError: false,
      skipWhenExpired: true,
    },
  }

  return jwtOptions.config
}

@NgModule({
  id: 'auth-angular',
  imports: [
    JwtModule.forRoot({
      jwtOptionsProvider: {
        provide:    JWT_OPTIONS,
        useFactory: jwtOptionsFactory,
        deps:       [],
      },
    }),
  ],
  providers: [
    Auth,
  ],
})
export class AuthModule {
}
