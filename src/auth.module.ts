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

export function jwtOptionsFactory() {
  const jwtOptions: JwtModuleOptions = {
    config: {
      tokenGetter: () => {
        return localStorage.getItem(STORAGE_KEY.ACCESS_TOKEN) || ''
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

    function authFactory(
      log:              Brolog,
      jwtHelperService: JwtHelperService,
    ): Auth {
      const auth = new Auth(log, jwtHelperService)
      auth.init()
      return auth
    }

  }
}