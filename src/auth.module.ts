import {
  ModuleWithProviders,
  NgModule,
}                           from '@angular/core'
import { HttpClientModule } from '@angular/common/http'

import {
  JWT_OPTIONS,
  JwtHelperService,
  JwtModule,
  JwtModuleOptions,
}                       from '@auth0/angular-jwt'
import { Brolog }       from 'brolog'

import { Auth }         from './auth'
import { STORAGE_KEY }  from './config'

export function tokenGetter() {
  return localStorage.getItem(STORAGE_KEY.ACCESS_TOKEN) || ''
}

export function jwtOptionsFactory() {
  const jwtOptions: JwtModuleOptions = {
    config: {
      // https://github.com/matheushf/ng2-date-countdown/issues/6#issuecomment-364641790
      tokenGetter: tokenGetter,
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

export function authFactory(
  log:              Brolog,
  jwtHelperService: JwtHelperService,
): Auth {
  const auth = new Auth(log, jwtHelperService)
  auth.init()
  return auth
}

@NgModule({
  id: 'auth-angular',
  imports: [
    HttpClientModule,
    JwtModule.forRoot({
      jwtOptionsProvider: {
        provide:    JWT_OPTIONS,
        useFactory: jwtOptionsFactory,
        deps:       [],
      },
    }),
  ],
})
export class AuthModule {
  public static forRoot(): ModuleWithProviders {
    return {
      ngModule: AuthModule,
      providers: [
        {
          provide:    Auth,
          useFactory: authFactory,
          deps: [
            Brolog,
            JwtHelperService,
          ],
        },
      ],
    }
  }
}
