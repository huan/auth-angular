import {
  Injectable,
}                     from '@angular/core'
// import { HttpClient } from '@angular/common/http'

import {
  JwtHelperService,
}                   from '@auth0/angular-jwt'
import {
  Auth0UserProfile,
  WebAuth,
}                   from 'auth0-js'
import Auth0Lock    from 'auth0-lock'
import { Brolog }   from 'brolog'
import {
  BehaviorSubject,
  Observable,
  Subscription,
}                   from 'rxjs/Rx'
import {
  // map,
}                   from 'rxjs/operators'

const STORAGE_KEY = {
  ACCESS_TOKEN:   'access_token',
  ID_TOKEN:       'id_token',
  USER_PROFILE:   'user_profile',
  /**
   * OIDC-conformant refresh tokens: https://auth0.com/docs/api-auth/tutorials/adoption/refresh-tokens
   * Silent Authentication: https://auth0.com/docs/api-auth/tutorials/silent-authentication
   */
  REFRESH_TOKEN:  'refresh_token',
}

/**
 * Auth0 API Configuration
 */
const AUTH0 = {
  CLIENT_ID:  'kW2jmKVAO6xMY9H4fYPUtFJSSRJbe3sz',
  DOMAIN:     'zixia.auth0.com',
}

// export interface AuthSnapshot {
//   valid:    boolean,
//   profile:  Auth0UserProfile,
// }

@Injectable()
export class Auth {

  private expireTimer?: NodeJS.Timer

  /**
   * User Profile: https://auth0.com/docs/user-profile
   * Structure of the User Profile: https://auth0.com/docs/user-profile/user-profile-structure
   * Control the contents of an ID token: https://auth0.com/docs/tokens/id-token#control-the-contents-of-an-id-token
   * OpenID Connect Standard Claims: https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims
   */
  private         profile$:     BehaviorSubject <Auth0UserProfile>
  public readonly profile:      Observable      <Auth0UserProfile>

  private accessToken$:         BehaviorSubject <string>
  public readonly accessToken:  Observable      <string>

  private idToken$:             BehaviorSubject <string>
  public readonly idToken:      Observable      <string>

  private refreshToken$:        BehaviorSubject <string>
  public readonly refreshToken: Observable      <string>

  // private localProfile: Auth0UserProfile

  /**
   * Persisting user authentication with BehaviorSubject in Angular
   *  - https://netbasal.com/angular-2-persist-your-login-status-with-behaviorsubject-45da9ec43243
   * BehaviorSubject.asObservable.toPromise() will not return the last value without next a new one! :(
   *  - https://github.com/ReactiveX/RxJS/issues/1478
   *  - https://github.com/Reactive-Extensions/RxJS/issues/1088
   */
  // private         valid$: BehaviorSubject <boolean>
  // public readonly valid:  Observable      <boolean>

  // private accessToken?:  string
  // private refreshToken?: string

  // private _idToken?:     string
  // private get idToken() {
  //   this.log.silly('Auth', 'get idToken() = %s', this._idToken && this._idToken.length)
  //   return this._idToken
  // }
  // private set idToken(newIdToken) {
  //   this.log.verbose('Auth', 'set idToken(%s)', newIdToken && newIdToken.length)
  //   this._idToken = newIdToken
  //   if (newIdToken) {
  //     this.scheduleExpire(newIdToken)
  //   } else {
  //     this.unscheduleExpire()
  //   }
  // }

  // TODO: the above scheduleExpire() & unscheduleExpire() should be checked in other place.

  private refreshSubscription: Subscription

  constructor(
    public log:         Brolog,
    // public httpClient:  HttpClient,
    public jwtHelper:   JwtHelperService,
  ) {
    this.log.verbose('Auth', 'constructor()')

    // this.snapshot     = {
    //   valid: false,
    //   profile: {},
    // } as AuthSnapshot

    // this.localProfile = {} as Auth0UserProfile

    /**
     * Init BehaviorSubjects
     */
    this.accessToken$   = new BehaviorSubject<string>('')
    this.idToken$       = new BehaviorSubject<string>('')
    this.refreshToken$  = new BehaviorSubject<string>('')

    this.profile$ = new BehaviorSubject<Auth0UserProfile>({} as Auth0UserProfile)
    // this.valid$   = new BehaviorSubject<boolean>(false)

    /**
     * Init asObservables
     */
    this.accessToken  = this.accessToken$ .asObservable().share().distinctUntilChanged()
    this.idToken      = this.idToken$     .asObservable().share().distinctUntilChanged()
    this.refreshToken = this.refreshToken$.asObservable().share().distinctUntilChanged()

    // this.valid    = this.valid$.asObservable()  .share().distinctUntilChanged()
    this.profile  = this.profile$.asObservable().share().distinctUntilChanged()

    // /**
    //  * Init
    //  */
    // this.init()
  }

  private async init() {
    this.log.verbose('Auth', 'init()')

    this.idToken.subscribe(token => {
      if (token) {
        this.scheduleRefresh(token)
        this.scheduleExpire(token)
      } else {
        this.unscheduleRefresh()
        this.unscheduleExpire()
      }
    })

    /**
     * Load from Storage
     */
    this.load()
  }

  public async load(): Promise<void> {
    this.log.verbose('Auth', 'load()')

    const accessToken  = localStorage.getItem(STORAGE_KEY.ACCESS_TOKEN)   || ''
    const idToken      = localStorage.getItem(STORAGE_KEY.ID_TOKEN)       || ''
    const refreshToken = localStorage.getItem(STORAGE_KEY.REFRESH_TOKEN)  || ''

    const profile = JSON.parse(
      localStorage.getItem(STORAGE_KEY.USER_PROFILE) || '""',
    ) as Auth0UserProfile

    // TODO: validate id_token

    this.accessToken$ .next(accessToken)
    this.idToken$     .next(idToken)
    this.refreshToken$.next(refreshToken)

    this.profile$.next(profile)
    // this.valid$.next(true)

    this.log.silly('Auth', 'load() idToken=%s, profile=%s',
                            idToken,
                            JSON.stringify(profile),
                  )
  }

  public async save(): Promise<void> {
    this.log.verbose('Auth', 'save()')

    localStorage.setItem(STORAGE_KEY.ACCESS_TOKEN,  await this.accessToken  .first().toPromise())
    localStorage.setItem(STORAGE_KEY.ID_TOKEN,      await this.idToken      .first().toPromise())
    localStorage.setItem(STORAGE_KEY.REFRESH_TOKEN, await this.refreshToken .first().toPromise())

    const profile = await this.profile      .first().toPromise()
    localStorage.setItem(STORAGE_KEY.USER_PROFILE, JSON.stringify(profile))
  }

  public async logout(): Promise<void> {
    this.log.verbose('Auth', 'logout()')

    // Remove token from localStorage
    localStorage.removeItem(STORAGE_KEY.ACCESS_TOKEN)
    localStorage.removeItem(STORAGE_KEY.ID_TOKEN)
    localStorage.removeItem(STORAGE_KEY.REFRESH_TOKEN)
    localStorage.removeItem(STORAGE_KEY.USER_PROFILE)

    this.accessToken$ .next('')
    this.idToken$     .next('')
    this.refreshToken$.next('')
    this.profile$     .next({} as any)
    // this.valid$       .next(false)
  }

  /**
   * Lock Configurable Options: https://auth0.com/docs/libraries/lock/v10/customization
   */
  private getAuth0Lock(): Auth0LockStatic {
    this.log.verbose('Auth', 'getAuth0Lock()')

    const options: Auth0LockConstructorOptions = {
      // oidcConformant: true,
      languageDictionary: {
        title: 'Chatie',
      },
      // Lock: Authentication Parameters
      // - https://auth0.com/docs/libraries/lock/v10/sending-authentication-parameters#supported-parameters
      auth: {
        params: {
          // scope: 'openid profile user_metadata app_metadata email offline_access ', // offline_access for refreshToken(?)
          scope: 'openid email profile offline_access', // offline_access for refreshToken(?)
        },
        redirect: false,  // must use popup for ionic2
        responseType: 'id_token token', // token for `accessToken`
      },
      allowSignUp:          false,
      allowForgotPassword:  false,
      allowedConnections: ['github'],
      initialScreen: 'login',
      // usernameStyle: 'email',
      socialButtonStyle: 'big',
      mustAcceptTerms:   true,
      rememberLastLogin: true,
      autofocus: true,
      autoclose: false,
      theme: {
        logo: 'https://avatars2.githubusercontent.com/u/25162437?v=3&s=200',
        primaryColor: '#32db64',
      },
    }

    const auth0Lock = new Auth0Lock(
      AUTH0.CLIENT_ID,
      AUTH0.DOMAIN,
      options,
    )

    // Rxjs.Observable.merge
    // Rxjs.Observable.fromEvent(auth0Lock, 'unrecoverable_error')
    // Rxjs.Observable.fromEvent(auth0Lock, 'authorization_error')
    auth0Lock.on('unrecoverable_error', error => {
      this.log.warn('Auth', 'login() on(unrecoverable_error) error:%s', error)
      this.idToken$.error(error)
      auth0Lock.hide()
    })

    auth0Lock.on('authorization_error', error => {
      this.log.verbose('Auth', 'login() on(authorization_error)')
      this.idToken$.error(error)
    })

    // Add callback for lock `authenticated` event
    // TODO: replace on with Observable.fromEvent().switchMap(getProfile)
    auth0Lock.on('authenticated', async (authResult) => {
      this.log.verbose('Auth', 'login() on(authenticated, authResult={%s})',
                                Object.keys(authResult).join(','),
                      )

      if (!authResult.idToken) {
        this.log.error('Auth', 'login() Auth0Lock.on(authenticated) no idToken')
        return
      }

      /**
       * make sure when the subscriber received the new idToken, there's a updated profile
       * by call next(profile) before next(idToken)
       */
      const profile = await this.getProfile(authResult.accessToken)
      this.profile$.next(profile)

      this.accessToken$ .next(authResult.accessToken)
      this.idToken$     .next(authResult.idToken)
      this.refreshToken$.next(authResult.refreshToken || '')

      // auth0Lock.getProfile(this.idToken, (error, profile) => {
      //   if (error) {
      //     // Handle error
      //     this.log.warn('Auth', 'login() Auth0Lock.getProfile() error:%s', error)
      //     return
      //   }
      //   this.log.verbose('Auth', 'login() Auth0Lock.getProfile() profile:{email:%s,...}',
      //                             profile.email,
      //                   )
      // }) // Auth0Lock.getProfile

      await this.save()
      auth0Lock.hide()
      this.log.verbose('Auth', 'getAuth0Lock() Auth0Lock.on(authenticated) _valid.next(true)')
      // this.valid$.next(true)
    })

    return auth0Lock
  }

  public async getProfile(accessToken: string): Promise<Auth0UserProfile> {
    this.log.verbose('Auth', 'getProfile()')

    return new Promise<Auth0UserProfile>(async (resolve, reject) => {
      // const idToken     = await this.idToken.first().toPromise()
      // const accessToken = await this.accessToken.first().toPromise()

      if (!accessToken) {
        const e = new Error('no access token')
        this.log.error('Auth', 'getProfile() %s', e.message)
        return reject(e)
      }

      // const userId: string = this.jwtHelper.decodeToken(this.idToken).sub
      // this.getManagement().getUser(userId, (error, profile) => {
      // auth0Lock.getProfile(this.idToken, (error, profile) => {
      // auth0Lock.getUserInfo(this.accessToken, (error, profile) => {

      this.getWebAuth().client.userInfo(accessToken, (error, profile) => {
        this.log.verbose('Auth', 'getProfile() WebAuth.client.userInfo()')

        if (error) {
          const e = new Error(error.description)
          this.log.error('Auth', 'getProfile() WebAuth.client.userInfo() %s', e.message)
          return reject(e)
        }

        this.log.silly('Auth', 'getProfile() WebAuth.client.userInfo() got {email=%s,...}', profile.email)
        return resolve(profile)

      })
    })
  }

  public getWebAuth() {
    this.log.verbose('Auth', 'getWebAuth()')

    return new WebAuth({
      clientID: AUTH0.CLIENT_ID,
      domain:   AUTH0.DOMAIN,
    })
  }

  /*
  getManagement() {
    this.log.verbose('Auth', 'getManagement')

    if (!this.accessToken) {
      throw new Error('no access token')
    }

    return new Management({
      domain: AUTH0.DOMAIN,
      token:  this.accessToken,
    })
  }
  */

    /*
    https://github.com/auth0/lock/issues/541

        authenticated$ = Observable
        .fromEvent(this.authService.authLock, 'authenticated')
        .do((authResult: any) => {
            localStorage.setItem('id_token', authResult.idToken);
        })
        .map(()=>new auth.LoginSuccessAction({}));

getProfile(idToken: string): Observable<any>{
        return new Observable(observer => {
            this.lock.getProfile(idToken, (err, profile) => {
            if (err) {
                observer.error(err);
            }
            else {
                console.log(profile);
                observer.next(profile);
                observer.complete();
            }
            });
        });
    }
    */

  /**
   *
   */
  public login(): void {
    this.log.verbose('Auth', 'login()')

    const auth0Lock = this.getAuth0Lock()

    // Call the show method to display the widget.
    auth0Lock.show()
  }

  // public authenticated(): boolean {
  //   // Check if there's an unexpired JWT
  //   // It searches for an item in localStorage with key == 'id_token'
  //   const invalid = !this.idToken || this.jwtHelper.isTokenExpired(this.idToken)
  //   this.log.verbose('Auth', 'authenticated(): %s', !invalid)

  //   return !invalid
  // }

  private scheduleExpire(idToken: string): void {
    this.log.verbose('Auth', 'scheduleExpire(idToken=%s)', idToken)

    if (!idToken) {
      this.log.error('Auth', 'scheduleExpire() no idToken')
      this.idToken$.error(new Error('scheduleExpire() no idToken'))
      return
    }

    if (this.expireTimer) {
      this.log.silly('Auth', 'scheduleExpire() clearTimeout()')
      clearTimeout(this.expireTimer)
      this.expireTimer = undefined
    }

    try {
      const expire  = this.jwtHelper.getTokenExpirationDate(idToken)
      const now     = new Date()

      let timeout = expire.getTime() - now.getTime()
      if (timeout < 0) {
        timeout = 0
      }

      this.expireTimer = setTimeout(() => {
        this.log.verbose('Auth', 'scheduleExpire() _valid.next(false)')
        this.logout()
      }, timeout)
      this.log.silly('Auth', 'scheduleExpire() setTimeout(,%s) = %s hours',
                              timeout,
                              Math.round(timeout / 3600) / 1000,
                    )
    } catch (e) {
      this.log.error('Auth', 'scheduleExpire() exception: %s', e.message)
    }
  }

  public async scheduleRefresh(idToken: string): Promise<void> {
    this.log.verbose('Auth', 'scheduleRefresh(idToken=%s)', idToken)

    // const idToken = await this.idToken.first().toPromise()

    if (!idToken) {
      this.log.error('Auth', 'scheduleRefresh() error: no idToken')
      this.idToken$.error(new Error('scheduleRefresh() no idToken'))
      return
    }

    // If the user is authenticated, use the token stream
    // provided by angular2-jwt and flatMap the token
    const source = Observable.of(idToken).flatMap(token => {
      if (!token) {
        const e = new Error('scheduleRefresh() failed to get token')
        this.log.error('Auth', e.message)
        throw e
      }

      const decodedToken = this.jwtHelper.decodeToken(token)
      this.log.verbose('Auth', 'scheduleRefresh() for token {email:%s,...}', decodedToken.email)

      // The delay to generate in this case is the difference
      // between the expiry time and the issued at time
      const jwtIat = this.jwtHelper.decodeToken(token).iat
      const jwtExp = this.jwtHelper.decodeToken(token).exp
      const iat = new Date(0)
      const exp = new Date(0)

      const delay = (exp.setUTCSeconds(jwtExp) - iat.setUTCSeconds(jwtIat))

      return Observable.interval(delay)
    })

    this.refreshSubscription = source.subscribe(() => {
      this.getNewJwt()
    })
  }

  public async startupTokenRefresh() {
    this.log.verbose('Auth', 'startupTokenRefresh()')

    const idToken = await this.idToken.first().toPromise()

    // http://stackoverflow.com/a/34190965/1123955
    if (idToken) {

      // FIXME: uncomment the code below

      // If the user is authenticated, use the token stream
      // provided by angular2-jwt and flatMap the token
      // const source = this.authHttp.tokenStream.flatMap(
      //   token => {
      //     // Get the expiry time to generate
      //     // a delay in milliseconds
      //     const now: number = new Date().valueOf()
      //     const jwtExp: number = this.jwtHelper.decodeToken(token).exp
      //     const exp: Date = new Date(0)
      //     exp.setUTCSeconds(jwtExp)

      //     // XXX the delay should be shorter
      //     // becasue we should emit refresh before scheduleExpire()
      //     // maybe 1 hour?
      //     const delay: number = exp.valueOf() - now

      //     // Use the delay in a timer to
      //     // run the refresh at the proper time
      //     return Observable.timer(delay)
      //   },
      // )

      // // Once the delay time from above is
      // // reached, get a new JWT and schedule
      // // additional refreshes
      // source.subscribe(() => {
      //   this.getNewJwt()
      //   this.scheduleRefresh()
      // })
    }
  }

  public unscheduleRefresh() {
    this.log.verbose('Auth', 'unscheduleRefresh()')

    // Unsubscribe fromt the refresh
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe()
    }
  }

  public unscheduleExpire(): void {
    this.log.verbose('Auth', 'unscheduleExpire()')

    if (this.expireTimer) {
      clearTimeout(this.expireTimer)
      this.log.silly('Auth', 'unscheduleExpire() clearTimeout()')
      this.expireTimer = undefined
    }
  }

  public async getNewJwt() {
    this.log.verbose('Auth', 'getNewJwt()')

    // Get a new JWT from Auth0 using the refresh token saved
    // in local storage
    try {
      // Configure Auth0
      /**
       * Token Lifetime: https://auth0.com/docs/tokens/id-token#token-lifetime
       */
      this.getWebAuth().renewAuth({
        // ???
        // https://github.com/auth0/auth0.js/blob/master/example/index.html
        // https://auth0.com/docs/libraries/auth0js/v8#using-renewauth-to-acquire-new-tokens
        // https://auth0.com/forum/t/remember-me-in-authservice-using-auth0-js-v8/5037
        //
        // audience: 'https://example.com/api/v2',
        // scope: 'read:something write:otherthing',

        // Hosted Login Page: https://auth0.com/docs/hosted-pages/login
        // redirectUri: 'https://zixia.auth0.com/login?client=g6P417oEmHON1BuPdsV9foNgP4h98dmh',
        usePostMessage: true,
      }, (err, authResult) => {
        if (err) {
          this.log.error('Auth', 'getNewJwt() WebAuth.renewAuth() error: %s', err)
          return
        }
        this.accessToken$ .next(authResult.accessToken)
        this.idToken$     .next(authResult.idToken)
        this.refreshToken$.next(authResult.refreshToken)

        this.save()

      })
    } catch (e) {
      this.log.error('Auth', 'getNewJwt() error: %s', e.message)
    }
  }

}
