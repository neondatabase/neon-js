import { AuthApiError, AuthError, isAuthError } from "@supabase/auth-js";
import { StackClientApp, StackServerApp } from "@stackframe/js";
import { z } from "zod";
import { PostgrestClient } from "@supabase/postgrest-js";

//#region src/auth/adapters/stack-auth/stack-auth-schemas.ts
const accessTokenSchema = z.object({
	exp: z.number(),
	iat: z.number(),
	sub: z.string(),
	email: z.string().nullable()
});

//#endregion
//#region src/auth/adapters/stack-auth/stack-auth-helpers.ts
/**
* Environment detection helpers for Stack Auth adapter
* Based on Supabase's auth-js implementation patterns
*/
/**
* Checks if the code is running in a browser environment
* @returns true if in browser, false otherwise (e.g., Node.js)
*/
const isBrowser = () => {
	return typeof window !== "undefined" && typeof document !== "undefined";
};
/**
* Checks if BroadcastChannel API is available
* Used for cross-tab authentication state synchronization
* @returns true if BroadcastChannel is available (browser only)
*/
const supportsBroadcastChannel = () => {
	return isBrowser() && typeof globalThis.BroadcastChannel !== "undefined";
};

//#endregion
//#region \0@oxc-project+runtime@0.95.0/helpers/typeof.js
function _typeof(o) {
	"@babel/helpers - typeof";
	return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o$1) {
		return typeof o$1;
	} : function(o$1) {
		return o$1 && "function" == typeof Symbol && o$1.constructor === Symbol && o$1 !== Symbol.prototype ? "symbol" : typeof o$1;
	}, _typeof(o);
}

//#endregion
//#region \0@oxc-project+runtime@0.95.0/helpers/toPrimitive.js
function toPrimitive(t, r) {
	if ("object" != _typeof(t) || !t) return t;
	var e = t[Symbol.toPrimitive];
	if (void 0 !== e) {
		var i = e.call(t, r || "default");
		if ("object" != _typeof(i)) return i;
		throw new TypeError("@@toPrimitive must return a primitive value.");
	}
	return ("string" === r ? String : Number)(t);
}

//#endregion
//#region \0@oxc-project+runtime@0.95.0/helpers/toPropertyKey.js
function toPropertyKey(t) {
	var i = toPrimitive(t, "string");
	return "symbol" == _typeof(i) ? i : i + "";
}

//#endregion
//#region \0@oxc-project+runtime@0.95.0/helpers/defineProperty.js
function _defineProperty(e, r, t) {
	return (r = toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
		value: t,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[r] = t, e;
}

//#endregion
//#region src/auth/adapters/stack-auth/stack-auth-adapter.ts
/**
* Type guard to check if Stack Auth user has internal session access
* Stack Auth exposes _internalSession with caching methods that we can leverage
*/
function hasInternalSession(user) {
	return user !== null && user !== void 0 && typeof user === "object" && "_internalSession" in user && user._internalSession !== null && user._internalSession !== void 0 && typeof user._internalSession === "object" && "getAccessTokenIfNotExpiredYet" in user._internalSession && typeof user._internalSession.getAccessTokenIfNotExpiredYet === "function" && "_refreshToken" in user._internalSession;
}
/**
* Map Stack Auth errors to Supabase error format
* This is Stack Auth-specific logic
*/
function normalizeStackAuthError(error) {
	if (error !== null && error !== void 0 && typeof error === "object" && "status" in error && error.status === "error" && "error" in error && error.error !== null && error.error !== void 0 && typeof error.error === "object" && "message" in error.error) {
		const message = error.error.message || "Authentication failed";
		let code = "unknown_error";
		let status = 400;
		if (message.includes("Invalid login credentials") || message.includes("incorrect")) {
			code = "invalid_credentials";
			status = 400;
		} else if (message.includes("already exists") || message.includes("already registered")) {
			code = "user_already_exists";
			status = 422;
		} else if (message.includes("not found")) {
			code = "user_not_found";
			status = 404;
		} else if (message.includes("token") && message.includes("invalid")) {
			code = "bad_jwt";
			status = 401;
		} else if (message.includes("token") && message.includes("expired")) {
			code = "bad_jwt";
			status = 401;
		} else if (message.includes("rate limit")) {
			code = "over_request_rate_limit";
			status = 429;
		} else if (message.includes("email") && message.includes("invalid")) {
			code = "email_address_invalid";
			status = 400;
		}
		return new AuthApiError(message, status, code);
	}
	if (error instanceof Error) return new AuthError(error.message, 500, "unexpected_failure");
	return new AuthError("An unexpected error occurred", 500, "unexpected_failure");
}
/**
* Stack Auth adapter implementing the AuthClient interface
*/
var StackAuthAdapter = class {
	constructor(params, config) {
		_defineProperty(this, "stackAuth", void 0);
		_defineProperty(this, "stateChangeEmitters", /* @__PURE__ */ new Map());
		_defineProperty(this, "broadcastChannel", null);
		_defineProperty(this, "tokenRefreshCheckInterval", null);
		_defineProperty(this, "config", {
			enableTokenRefreshDetection: true,
			tokenRefreshCheckInterval: 3e4
		});
		_defineProperty(this, "admin", void 0);
		_defineProperty(this, "mfa", void 0);
		_defineProperty(this, "initialize", async () => {
			try {
				const session = await this.getSession();
				return {
					data: session.data,
					error: session.error
				};
			} catch (error) {
				return {
					data: { session: null },
					error: normalizeStackAuthError(error)
				};
			}
		});
		_defineProperty(this, "signUp", async (credentials) => {
			try {
				if ("email" in credentials && credentials.email && credentials.password) {
					const result = await this.stackAuth.signUpWithCredential({
						email: credentials.email,
						password: credentials.password,
						noRedirect: true,
						...credentials.options?.data ? { clientMetadata: credentials.options.data } : {}
					});
					if (result.status === "error") return {
						data: {
							user: null,
							session: null
						},
						error: normalizeStackAuthError(result)
					};
					const sessionResult = await this.getSession();
					if (!sessionResult.data.session?.user) return {
						data: {
							user: null,
							session: null
						},
						error: new AuthError("Failed to retrieve user session", 500, "unexpected_failure")
					};
					const data = {
						user: sessionResult.data.session.user,
						session: sessionResult.data.session
					};
					await this.notifyAllSubscribers("SIGNED_IN", sessionResult.data.session);
					return {
						data,
						error: null
					};
				} else if ("phone" in credentials && credentials.phone) return {
					data: {
						user: null,
						session: null
					},
					error: new AuthError("Phone sign-up not supported", 501, "phone_provider_disabled")
				};
				else return {
					data: {
						user: null,
						session: null
					},
					error: new AuthError("Invalid credentials format", 400, "validation_failed")
				};
			} catch (error) {
				return {
					data: {
						user: null,
						session: null
					},
					error: normalizeStackAuthError(error)
				};
			}
		});
		_defineProperty(this, "signInAnonymously", async () => {
			return {
				data: {
					user: null,
					session: null
				},
				error: new AuthError("Anonymous sign-in is not supported by Stack Auth", 501, "anonymous_provider_disabled")
			};
		});
		_defineProperty(this, "signInWithPassword", async (credentials) => {
			try {
				if ("email" in credentials && credentials.email) {
					const result = await this.stackAuth.signInWithCredential({
						email: credentials.email,
						password: credentials.password,
						noRedirect: true
					});
					if (result.status === "error") return {
						data: {
							user: null,
							session: null
						},
						error: normalizeStackAuthError(result)
					};
					const sessionResult = await this.getSession();
					if (!sessionResult.data.session?.user) return {
						data: {
							user: null,
							session: null
						},
						error: new AuthError("Failed to retrieve user session", 500, "unexpected_failure")
					};
					const data = {
						user: sessionResult.data.session.user,
						session: sessionResult.data.session
					};
					await this.notifyAllSubscribers("SIGNED_IN", sessionResult.data.session);
					return {
						data,
						error: null
					};
				} else if ("phone" in credentials && credentials.phone) return {
					data: {
						user: null,
						session: null
					},
					error: new AuthError("Phone sign-in not supported", 501, "phone_provider_disabled")
				};
				else return {
					data: {
						user: null,
						session: null
					},
					error: new AuthError("Invalid credentials format", 400, "validation_failed")
				};
			} catch (error) {
				return {
					data: {
						user: null,
						session: null
					},
					error: normalizeStackAuthError(error)
				};
			}
		});
		_defineProperty(this, "signInWithOAuth", async (credentials) => {
			try {
				const { provider, options } = credentials;
				await this.stackAuth.signInWithOAuth(provider, { returnTo: options?.redirectTo });
				return {
					data: {
						provider,
						url: options?.redirectTo || ""
					},
					error: null
				};
			} catch (error) {
				return {
					data: {
						provider: credentials.provider,
						url: null
					},
					error: normalizeStackAuthError(error)
				};
			}
		});
		_defineProperty(this, "signInWithOtp", async (credentials) => {
			try {
				if ("email" in credentials && credentials.email) {
					const result = await this.stackAuth.sendMagicLinkEmail(credentials.email, { callbackUrl: credentials.options?.emailRedirectTo });
					if (result.status === "error") return {
						data: {
							user: null,
							session: null,
							messageId: void 0
						},
						error: normalizeStackAuthError(result)
					};
					return {
						data: {
							user: null,
							session: null,
							messageId: void 0
						},
						error: null
					};
				} else if ("phone" in credentials && credentials.phone) return {
					data: {
						user: null,
						session: null,
						messageId: void 0
					},
					error: new AuthError("Phone OTP not supported", 501, "phone_provider_disabled")
				};
				else return {
					data: {
						user: null,
						session: null,
						messageId: void 0
					},
					error: new AuthError("Invalid credentials format", 400, "validation_failed")
				};
			} catch (error) {
				return {
					data: {
						user: null,
						session: null,
						messageId: void 0
					},
					error: normalizeStackAuthError(error)
				};
			}
		});
		_defineProperty(this, "signInWithIdToken", async (credentials) => {
			/**
			* Stack Auth does not support direct OIDC ID token authentication.
			*
			* Supabase's signInWithIdToken accepts pre-existing OIDC ID tokens from providers like:
			* - Google, Apple, Azure, Facebook, Kakao, Keycloak
			* - Validates the ID token server-side
			* - Can handle tokens with at_hash (requires access_token) and nonce claims
			*
			* Stack Auth uses OAuth authorization code flow with redirects instead:
			* - Requires redirecting users to the OAuth provider
			* - Handles the OAuth callback to exchange authorization code for tokens
			* - Does not accept pre-existing ID tokens directly
			*
			* For OAuth providers, use signInWithOAuth instead:
			* ```
			* await authAdapter.signInWithOAuth({ provider: 'google', options: { redirectTo: '...' } });
			* ```
			*/
			const attemptedProvider = credentials.provider;
			const hasAccessToken = !!credentials.access_token;
			const hasNonce = !!credentials.nonce;
			return {
				data: {
					user: null,
					session: null
				},
				error: new AuthError(`Stack Auth does not support OIDC ID token authentication. Attempted with provider: ${attemptedProvider}${hasAccessToken ? " (with access_token)" : ""}${hasNonce ? " (with nonce)" : ""}. Stack Auth uses OAuth authorization code flow and does not accept pre-existing ID tokens. Please use signInWithOAuth() to redirect users to the OAuth provider for authentication.`, 501, "id_token_provider_disabled")
			};
		});
		_defineProperty(this, "signInWithSSO", async (params$1) => {
			return {
				data: null,
				error: new AuthError(`Stack Auth does not support enterprise SAML SSO. Attempted with ${"providerId" in params$1 ? `provider ID: ${params$1.providerId}` : `domain: ${"domain" in params$1 ? params$1.domain : "unknown"}`}. Stack Auth only supports OAuth social providers (Google, GitHub, Microsoft, etc.). Please use signInWithOAuth() for OAuth providers instead.`, 501, "sso_provider_disabled")
			};
		});
		_defineProperty(this, "signInWithWeb3", async (credentials) => {
			/**
			* Stack Auth does not support Web3/crypto wallet authentication (Ethereum, Solana, etc.)
			*
			* Supabase's signInWithWeb3 enables authentication with crypto wallets like:
			* - Ethereum: MetaMask, WalletConnect, Coinbase Wallet (using EIP-1193)
			* - Solana: Phantom, Solflare (using Sign-In with Solana standard)
			*
			* Stack Auth only supports:
			* - OAuth social providers (Google, GitHub, Microsoft, etc.)
			* - Email/Password credentials
			* - Magic link (passwordless email)
			* - Passkey/WebAuthn
			* - Anonymous sign-in
			*
			* For OAuth providers, use signInWithOAuth instead:
			* ```
			* await authAdapter.signInWithOAuth({ provider: 'google', options: { redirectTo: '...' } });
			* ```
			*/
			const attemptedChain = credentials.chain;
			return {
				data: {
					user: null,
					session: null
				},
				error: new AuthError(`Stack Auth does not support Web3 authentication. Attempted with chain: ${attemptedChain}. Stack Auth does not support crypto wallet sign-in (Ethereum, Solana, etc.). Supported authentication methods: OAuth, email/password, magic link, passkey, or anonymous. For social authentication, please use signInWithOAuth() instead.`, 501, "web3_provider_disabled")
			};
		});
		_defineProperty(this, "signOut", async () => {
			try {
				const internalSession = await this._getSessionFromStackAuthInternals();
				if (!internalSession) throw new AuthError("No session found", 401, "session_not_found");
				await this.stackAuth._interface.signOut(internalSession);
				await this.notifyAllSubscribers("SIGNED_OUT", null);
				return { error: null };
			} catch (error) {
				return { error: normalizeStackAuthError(error) };
			}
		});
		_defineProperty(this, "verifyOtp", async (params$1) => {
			try {
				if ("email" in params$1 && params$1.email) {
					const { token, type } = params$1;
					if (type === "magiclink" || type === "email") {
						let internalSession = await this._getSessionFromStackAuthInternals();
						if (!internalSession) internalSession = this.stackAuth._interface.createSession({
							refreshToken: null,
							accessToken: null
						});
						const result = await this.stackAuth._interface.signInWithMagicLink(token, internalSession);
						if (result.status === "error") return {
							data: {
								user: null,
								session: null
							},
							error: normalizeStackAuthError(result)
						};
						const sessionResult = await this.getSession();
						if (!sessionResult.data.session) return {
							data: {
								user: null,
								session: null
							},
							error: new AuthError("Failed to retrieve session after OTP verification", 500, "unexpected_failure")
						};
						await this.notifyAllSubscribers("SIGNED_IN", sessionResult.data.session);
						return {
							data: {
								user: sessionResult.data.session.user,
								session: sessionResult.data.session
							},
							error: null
						};
					}
					if (type === "signup" || type === "invite") {
						const result = await this.stackAuth._interface.verifyEmail(token);
						if (result.status === "error") return {
							data: {
								user: null,
								session: null
							},
							error: normalizeStackAuthError(result)
						};
						const sessionResult = await this.getSession();
						return {
							data: {
								user: sessionResult.data.session?.user ?? null,
								session: sessionResult.data.session
							},
							error: null
						};
					}
					if (type === "recovery") {
						const result = await this.stackAuth._interface.resetPassword({
							code: token,
							onlyVerifyCode: true
						});
						if (result.status === "error") return {
							data: {
								user: null,
								session: null
							},
							error: normalizeStackAuthError(result)
						};
						return {
							data: {
								user: null,
								session: null
							},
							error: null
						};
					}
					if (type === "email_change") {
						const result = await this.stackAuth._interface.verifyEmail(token);
						if (result.status === "error") return {
							data: {
								user: null,
								session: null
							},
							error: normalizeStackAuthError(result)
						};
						const sessionResult = await this.getSession();
						await this.notifyAllSubscribers("USER_UPDATED", sessionResult.data.session);
						return {
							data: {
								user: sessionResult.data.session?.user ?? null,
								session: sessionResult.data.session
							},
							error: null
						};
					}
					return {
						data: {
							user: null,
							session: null
						},
						error: new AuthError(`Unsupported email OTP type: ${type}`, 400, "validation_failed")
					};
				}
				if ("phone" in params$1 && params$1.phone) return {
					data: {
						user: null,
						session: null
					},
					error: new AuthError("Phone OTP verification not supported by Stack Auth", 501, "phone_provider_disabled")
				};
				if ("token_hash" in params$1 && params$1.token_hash) {
					const { token_hash, type } = params$1;
					if (type === "magiclink" || type === "email") {
						let internalSession = await this._getSessionFromStackAuthInternals();
						if (!internalSession) internalSession = this.stackAuth._interface.createSession({
							refreshToken: null,
							accessToken: null
						});
						const result = await this.stackAuth._interface.signInWithMagicLink(token_hash, internalSession);
						if (result.status === "error") return {
							data: {
								user: null,
								session: null
							},
							error: normalizeStackAuthError(result)
						};
						const sessionResult = await this.getSession();
						if (!sessionResult.data.session) return {
							data: {
								user: null,
								session: null
							},
							error: new AuthError("Failed to retrieve session after token hash verification", 500, "unexpected_failure")
						};
						await this.notifyAllSubscribers("SIGNED_IN", sessionResult.data.session);
						return {
							data: {
								user: sessionResult.data.session.user,
								session: sessionResult.data.session
							},
							error: null
						};
					}
					if (type === "signup" || type === "invite") {
						const result = await this.stackAuth._interface.verifyEmail(token_hash);
						if (result.status === "error") return {
							data: {
								user: null,
								session: null
							},
							error: normalizeStackAuthError(result)
						};
						const sessionResult = await this.getSession();
						return {
							data: {
								user: sessionResult.data.session?.user ?? null,
								session: sessionResult.data.session
							},
							error: null
						};
					}
					if (type === "recovery") {
						const result = await this.stackAuth._interface.resetPassword({
							code: token_hash,
							onlyVerifyCode: true
						});
						if (result.status === "error") return {
							data: {
								user: null,
								session: null
							},
							error: normalizeStackAuthError(result)
						};
						return {
							data: {
								user: null,
								session: null
							},
							error: null
						};
					}
					if (type === "email_change") {
						const result = await this.stackAuth._interface.verifyEmail(token_hash);
						if (result.status === "error") return {
							data: {
								user: null,
								session: null
							},
							error: normalizeStackAuthError(result)
						};
						const sessionResult = await this.getSession();
						await this.notifyAllSubscribers("USER_UPDATED", sessionResult.data.session);
						return {
							data: {
								user: sessionResult.data.session?.user ?? null,
								session: sessionResult.data.session
							},
							error: null
						};
					}
					return {
						data: {
							user: null,
							session: null
						},
						error: new AuthError(`Unsupported token hash OTP type: ${type}`, 400, "validation_failed")
					};
				}
				return {
					data: {
						user: null,
						session: null
					},
					error: new AuthError("Invalid OTP verification parameters", 400, "validation_failed")
				};
			} catch (error) {
				return {
					data: {
						user: null,
						session: null
					},
					error: normalizeStackAuthError(error)
				};
			}
		});
		_defineProperty(this, "getSession", async () => {
			try {
				let session = null;
				const cachedTokens = await this._getCachedTokensFromStackAuthInternals();
				if (cachedTokens?.accessToken) {
					const payload = accessTokenSchema.parse(JSON.parse(atob(cachedTokens.accessToken.split(".")[1])));
					session = {
						access_token: cachedTokens.accessToken,
						refresh_token: cachedTokens.refreshToken ?? "",
						expires_at: payload.exp,
						expires_in: Math.max(0, payload.exp - Math.floor(Date.now() / 1e3)),
						token_type: "bearer",
						user: {
							id: payload.sub,
							email: payload.email || "",
							created_at: (/* @__PURE__ */ new Date(payload.iat * 1e3)).toISOString(),
							aud: "authenticated",
							role: "authenticated",
							app_metadata: {},
							user_metadata: {}
						}
					};
				} else {
					const user = await this.stackAuth.getUser();
					if (user) {
						const tokens = await user.currentSession.getTokens();
						if (tokens.accessToken) {
							const payload = accessTokenSchema.parse(JSON.parse(atob(tokens.accessToken.split(".")[1])));
							session = {
								access_token: tokens.accessToken,
								refresh_token: tokens.refreshToken ?? "",
								expires_at: payload.exp,
								expires_in: Math.max(0, payload.exp - Math.floor(Date.now() / 1e3)),
								token_type: "bearer",
								user: {
									id: user.id,
									email: user.primaryEmail || "",
									email_confirmed_at: user.primaryEmailVerified ? user.signedUpAt.toISOString() : void 0,
									last_sign_in_at: user.signedUpAt.toISOString(),
									created_at: user.signedUpAt.toISOString(),
									updated_at: user.signedUpAt.toISOString(),
									aud: "authenticated",
									role: "authenticated",
									app_metadata: user.clientReadOnlyMetadata,
									user_metadata: {
										displayName: user.displayName,
										profileImageUrl: user.profileImageUrl,
										...user.clientMetadata
									},
									identities: []
								}
							};
						}
					}
				}
				if (session) return {
					data: { session },
					error: null
				};
				else return {
					data: { session: null },
					error: null
				};
			} catch (error) {
				console.error("Error getting session:", error);
				return {
					data: { session: null },
					error: normalizeStackAuthError(error)
				};
			}
		});
		_defineProperty(this, "refreshSession", async () => {
			try {
				const sessionResult = await this.getSession();
				if (sessionResult.error) return {
					data: {
						user: null,
						session: null
					},
					error: sessionResult.error
				};
				return {
					data: {
						user: sessionResult.data.session?.user ?? null,
						session: sessionResult.data.session
					},
					error: null
				};
			} catch (error) {
				return {
					data: {
						user: null,
						session: null
					},
					error: normalizeStackAuthError(error)
				};
			}
		});
		_defineProperty(this, "setSession", async () => {
			return {
				data: {
					user: null,
					session: null
				},
				error: new AuthError("Setting external sessions is not supported by Stack Auth", 501, "not_implemented")
			};
		});
		_defineProperty(this, "getUser", async () => {
			try {
				const user = await this.stackAuth.getUser();
				if (!user) return {
					data: { user: null },
					error: new AuthError("No user session found", 401, "session_not_found")
				};
				return {
					data: { user: {
						id: user.id,
						aud: "authenticated",
						role: "authenticated",
						email: user.primaryEmail || "",
						email_confirmed_at: user.primaryEmailVerified ? user.signedUpAt.toISOString() : void 0,
						phone: void 0,
						confirmed_at: user.primaryEmailVerified ? user.signedUpAt.toISOString() : void 0,
						last_sign_in_at: user.signedUpAt.toISOString(),
						app_metadata: {},
						user_metadata: {
							...user.clientMetadata,
							...user.displayName ? { displayName: user.displayName } : {},
							...user.profileImageUrl ? { profileImageUrl: user.profileImageUrl } : {}
						},
						identities: [],
						created_at: user.signedUpAt.toISOString(),
						updated_at: user.signedUpAt.toISOString()
					} },
					error: null
				};
			} catch (error) {
				return {
					data: { user: null },
					error: normalizeStackAuthError(error)
				};
			}
		});
		_defineProperty(this, "getClaims", async () => {
			try {
				const user = await this.stackAuth.getUser();
				if (!user) return {
					data: null,
					error: new AuthError("No user session found", 401, "session_not_found")
				};
				let accessToken = null;
				if (hasInternalSession(user)) accessToken = user._internalSession.getAccessTokenIfNotExpiredYet(0)?.token ?? null;
				if (!accessToken) accessToken = (await user.currentSession.getTokens()).accessToken;
				if (!accessToken) return {
					data: null,
					error: new AuthError("No access token found", 401, "session_not_found")
				};
				const tokenParts = accessToken.split(".");
				if (tokenParts.length !== 3) return {
					data: null,
					error: new AuthError("Invalid token format", 401, "bad_jwt")
				};
				try {
					return {
						data: JSON.parse(atob(tokenParts[1])),
						error: null
					};
				} catch {
					return {
						data: null,
						error: new AuthError("Failed to decode token", 401, "bad_jwt")
					};
				}
			} catch (error) {
				return {
					data: null,
					error: normalizeStackAuthError(error)
				};
			}
		});
		_defineProperty(this, "updateUser", async (attributes) => {
			try {
				const user = await this.stackAuth.getUser();
				if (!user) return {
					data: { user: null },
					error: new AuthError("No user session found", 401, "session_not_found")
				};
				if (attributes.password) return {
					data: { user: null },
					error: new AuthError("Password updates require reauthentication. Stack Auth does not support the nonce-based reauthentication flow (reauthenticate() method). For password changes, users must: 1) Sign out, 2) Use \"Forgot Password\" flow (resetPasswordForEmail), or 3) Use Stack Auth directly with updatePassword({ oldPassword, newPassword }).", 400, "feature_not_supported")
				};
				const updateData = {};
				if (attributes.data) {
					const data$1 = attributes.data;
					if (data$1 && "displayName" in data$1 && typeof data$1.displayName === "string") updateData.displayName = data$1.displayName;
					if (data$1 && "profileImageUrl" in data$1 && typeof data$1.profileImageUrl === "string") updateData.profileImageUrl = data$1.profileImageUrl;
					updateData.clientMetadata = {
						...user.clientMetadata,
						...attributes.data
					};
				}
				await user.update(updateData);
				if (attributes.email) console.warn("Email updates require server-side Stack Auth configuration");
				const updatedUser = await this.stackAuth.getUser();
				if (!updatedUser) throw new Error("Failed to retrieve updated user");
				const data = { user: {
					id: updatedUser.id,
					aud: "authenticated",
					role: "authenticated",
					email: updatedUser.primaryEmail || "",
					email_confirmed_at: updatedUser.primaryEmailVerified ? updatedUser.signedUpAt.toISOString() : void 0,
					phone: void 0,
					confirmed_at: updatedUser.primaryEmailVerified ? updatedUser.signedUpAt.toISOString() : void 0,
					last_sign_in_at: updatedUser.signedUpAt.toISOString(),
					app_metadata: {},
					user_metadata: {
						...updatedUser.clientMetadata,
						...updatedUser.displayName ? { displayName: updatedUser.displayName } : {},
						...updatedUser.profileImageUrl ? { profileImageUrl: updatedUser.profileImageUrl } : {}
					},
					identities: [],
					created_at: updatedUser.signedUpAt.toISOString(),
					updated_at: updatedUser.signedUpAt.toISOString()
				} };
				const sessionResult = await this.getSession();
				await this.notifyAllSubscribers("USER_UPDATED", sessionResult.data.session);
				return {
					data,
					error: null
				};
			} catch (error) {
				return {
					data: { user: null },
					error: normalizeStackAuthError(error)
				};
			}
		});
		_defineProperty(this, "getUserIdentities", async () => {
			try {
				const user = await this.stackAuth.getUser();
				if (!user) return {
					data: null,
					error: new AuthError("No user session found", 401, "session_not_found")
				};
				return {
					data: { identities: (await user.listOAuthProviders()).map((provider) => ({
						id: provider.id,
						user_id: user.id,
						identity_id: provider.id,
						provider: provider.type,
						identity_data: {
							email: provider.email || null,
							account_id: provider.accountId || null,
							provider_type: provider.type,
							user_id: provider.userId,
							allow_sign_in: provider.allowSignIn,
							allow_connected_accounts: provider.allowConnectedAccounts
						},
						created_at: user.signedUpAt.toISOString(),
						last_sign_in_at: user.signedUpAt.toISOString(),
						updated_at: user.signedUpAt.toISOString()
					})) },
					error: null
				};
			} catch (error) {
				return {
					data: null,
					error: normalizeStackAuthError(error)
				};
			}
		});
		_defineProperty(this, "linkIdentity", async (credentials) => {
			try {
				const user = await this.stackAuth.getUser();
				if (!user) return {
					data: {
						provider: credentials.provider,
						url: null
					},
					error: new AuthError("No user session found", 401, "session_not_found")
				};
				const scopes = credentials.options?.scopes ? credentials.options.scopes.split(" ") : void 0;
				await user.getConnectedAccount(credentials.provider, {
					or: "redirect",
					scopes
				});
				return {
					data: {
						provider: credentials.provider,
						url: credentials.options?.redirectTo || ""
					},
					error: null
				};
			} catch (error) {
				return {
					data: {
						provider: credentials.provider,
						url: null
					},
					error: normalizeStackAuthError(error)
				};
			}
		});
		_defineProperty(this, "unlinkIdentity", async (identity) => {
			try {
				const user = await this.stackAuth.getUser();
				if (!user) return {
					data: null,
					error: new AuthError("No user session found", 401, "session_not_found")
				};
				const provider = await user.getOAuthProvider(identity.identity_id);
				if (!provider) return {
					data: null,
					error: new AuthError(`OAuth provider with ID ${identity.identity_id} not found`, 404, "identity_not_found")
				};
				await provider.delete();
				const sessionResult = await this.getSession();
				await this.notifyAllSubscribers("USER_UPDATED", sessionResult.data.session);
				return {
					data: {},
					error: null
				};
			} catch (error) {
				return {
					data: null,
					error: normalizeStackAuthError(error)
				};
			}
		});
		_defineProperty(this, "resetPasswordForEmail", async (email, options) => {
			try {
				const result = await this.stackAuth.sendForgotPasswordEmail(email, { callbackUrl: options?.redirectTo });
				if (result.status === "error") return {
					data: null,
					error: normalizeStackAuthError(result)
				};
				return {
					data: {},
					error: null
				};
			} catch (error) {
				return {
					data: null,
					error: normalizeStackAuthError(error)
				};
			}
		});
		_defineProperty(this, "reauthenticate", async () => {
			return {
				data: {
					user: null,
					session: null
				},
				error: new AuthError("Stack Auth does not support nonce-based reauthentication. For password changes, use the password reset flow (resetPasswordForEmail) or access Stack Auth directly.", 400, "feature_not_supported")
			};
		});
		_defineProperty(this, "resend", async (credentials) => {
			try {
				if ("email" in credentials) {
					const { email, type, options } = credentials;
					if (type === "signup") {
						const user = await this.stackAuth.getUser();
						if (user && user.primaryEmail === email) await user.sendVerificationEmail();
						else {
							const result = await this.stackAuth.sendMagicLinkEmail(email, { callbackUrl: options?.emailRedirectTo });
							if (result.status === "error") return {
								data: {
									user: null,
									session: null
								},
								error: normalizeStackAuthError(result)
							};
						}
						return {
							data: {
								user: null,
								session: null
							},
							error: null
						};
					}
					if (type === "email_change") {
						const user = await this.stackAuth.getUser();
						if (!user) return {
							data: {
								user: null,
								session: null
							},
							error: new AuthError("No user session found", 401, "session_not_found")
						};
						const targetChannel = (await user.listContactChannels()).find((ch) => ch.value === email && ch.type === "email");
						if (!targetChannel) return {
							data: {
								user: null,
								session: null
							},
							error: new AuthError("Email not found in user contact channels", 404, "email_not_found")
						};
						await targetChannel.sendVerificationEmail({ callbackUrl: options?.emailRedirectTo });
						return {
							data: {
								user: null,
								session: null
							},
							error: null
						};
					}
					return {
						data: {
							user: null,
							session: null
						},
						error: new AuthError(`Unsupported resend type: ${type}`, 400, "validation_failed")
					};
				}
				if ("phone" in credentials) return {
					data: {
						user: null,
						session: null
					},
					error: new AuthError("Phone OTP resend not supported by Stack Auth", 501, "phone_provider_disabled")
				};
				return {
					data: {
						user: null,
						session: null
					},
					error: new AuthError("Invalid credentials format", 400, "validation_failed")
				};
			} catch (error) {
				return {
					data: {
						user: null,
						session: null
					},
					error: normalizeStackAuthError(error)
				};
			}
		});
		_defineProperty(this, "onAuthStateChange", (callback) => {
			const id = crypto.randomUUID();
			const subscription = {
				id,
				callback,
				unsubscribe: () => {
					this.stateChangeEmitters.delete(id);
					if (this.stateChangeEmitters.size === 0) {
						this.stopTokenRefreshDetection();
						this.closeBroadcastChannel();
					}
				}
			};
			this.stateChangeEmitters.set(id, subscription);
			if (this.stateChangeEmitters.size === 1) {
				this.initializeBroadcastChannel();
				this.startTokenRefreshDetection();
			}
			this.emitInitialSession(callback);
			return { data: { subscription: {
				id,
				callback,
				unsubscribe: subscription.unsubscribe
			} } };
		});
		_defineProperty(
			this,
			/**
			* Exchange an OAuth authorization code for a session.
			*
			* Note: Stack Auth handles OAuth callbacks automatically via callOAuthCallback().
			* This method delegates to Stack Auth's internal flow which:
			* - Retrieves the code and state from the current URL
			* - Retrieves the PKCE verifier from cookies (stored during signInWithOAuth)
			* - Exchanges the code for access/refresh tokens
			* - Creates and stores the user session
			*
			* @param authCode - The authorization code (Stack Auth reads this from URL automatically)
			* @returns Session data or error
			*/
			"exchangeCodeForSession",
			async (_authCode) => {
				try {
					if (await this.stackAuth.callOAuthCallback()) {
						const sessionResult = await this.getSession();
						if (sessionResult.data.session) {
							await this.notifyAllSubscribers("SIGNED_IN", sessionResult.data.session);
							return {
								data: {
									session: sessionResult.data.session,
									user: sessionResult.data.session.user
								},
								error: null
							};
						}
					}
					return {
						data: {
							session: null,
							user: null
						},
						error: new AuthError("OAuth callback completed but no session was created", 500, "oauth_callback_failed")
					};
				} catch (error) {
					return {
						data: {
							session: null,
							user: null
						},
						error: normalizeStackAuthError(error)
					};
				}
			}
		);
		_defineProperty(this, "startAutoRefresh", async () => {
			return Promise.resolve();
		});
		_defineProperty(this, "stopAutoRefresh", async () => {
			return Promise.resolve();
		});
		if (config) this.config = {
			...this.config,
			...config
		};
		this.stackAuth = params.secretServerKey ? new StackServerApp(params) : new StackClientApp(params);
	}
	async _getSessionFromStackAuthInternals() {
		const tokenStore = await this.stackAuth._getOrCreateTokenStore(await this.stackAuth._createCookieHelper());
		return this.stackAuth._getSessionFromTokenStore(tokenStore);
	}
	async _getCachedTokensFromStackAuthInternals() {
		try {
			const session = await this._getSessionFromStackAuthInternals();
			const accessToken = session?.getAccessTokenIfNotExpiredYet(0);
			if (!accessToken) return null;
			return {
				accessToken: accessToken.token,
				refreshToken: session?._refreshToken?.token ?? null
			};
		} catch {
			return null;
		}
	}
	async emitInitialSession(callback) {
		try {
			const { data, error } = await this.getSession();
			if (error) {
				await callback("INITIAL_SESSION", null);
				return;
			}
			await callback("INITIAL_SESSION", data.session);
		} catch (error) {
			await callback("INITIAL_SESSION", null);
		}
	}
	async notifyAllSubscribers(event, session, broadcast = true) {
		if (broadcast && this.broadcastChannel) try {
			this.broadcastChannel.postMessage({
				event,
				session,
				timestamp: Date.now()
			});
		} catch (error) {
			console.warn("BroadcastChannel postMessage failed:", error);
		}
		const promises = Array.from(this.stateChangeEmitters.values()).map((subscription) => {
			try {
				return Promise.resolve(subscription.callback(event, session));
			} catch (error) {
				console.error("Auth state change callback error:", error);
				return Promise.resolve();
			}
		});
		await Promise.allSettled(promises);
	}
	initializeBroadcastChannel() {
		if (!supportsBroadcastChannel()) return;
		if (!this.broadcastChannel) try {
			this.broadcastChannel = new BroadcastChannel("stack-auth-state-changes");
			this.broadcastChannel.onmessage = async (event) => {
				const { event: authEvent, session } = event.data;
				await this.notifyAllSubscribers(authEvent, session, false);
			};
		} catch (error) {
			console.error("Failed to create BroadcastChannel, cross-tab sync will not be available:", error);
		}
	}
	closeBroadcastChannel() {
		if (this.broadcastChannel) {
			this.broadcastChannel.close();
			this.broadcastChannel = null;
		}
	}
	startTokenRefreshDetection() {
		if (!this.config.enableTokenRefreshDetection) return;
		if (this.tokenRefreshCheckInterval) return;
		this.tokenRefreshCheckInterval = setInterval(async () => {
			try {
				const sessionResult = await this.getSession();
				if (!sessionResult.data.session) return;
				const session = sessionResult.data.session;
				const now = Math.floor(Date.now() / 1e3);
				const expiresInSeconds = (session.expires_at ?? now) - now;
				if (expiresInSeconds <= 0) {
					await this.notifyAllSubscribers("SIGNED_OUT", null);
					return;
				}
				if (expiresInSeconds <= 90 && expiresInSeconds > 0) await this.notifyAllSubscribers("TOKEN_REFRESHED", session);
			} catch (error) {
				console.error("Token refresh detection error:", error);
			}
		}, this.config.tokenRefreshCheckInterval);
	}
	stopTokenRefreshDetection() {
		if (this.tokenRefreshCheckInterval) {
			clearInterval(this.tokenRefreshCheckInterval);
			this.tokenRefreshCheckInterval = null;
		}
	}
};

//#endregion
//#region src/client/neon-client.ts
var NeonClient = class extends PostgrestClient {
	constructor({ url, options }) {
		super(url, {
			headers: options?.global?.headers,
			fetch: options?.global?.fetch,
			schema: options?.db?.schema
		});
		_defineProperty(this, "auth", void 0);
	}
};

//#endregion
//#region src/client/fetch-with-auth.ts
/**
* Error thrown when authentication is required but no session exists
*/
var AuthRequiredError = class extends Error {
	constructor(message = "Authentication required. User must be signed in to access Neon database.") {
		super(message);
		this.name = "AuthRequiredError";
	}
};
/**
* Creates a fetch wrapper that injects auth headers into every request
*
* Unlike Supabase, Neon requires authentication - requests without a valid
* session will throw an AuthRequiredError.
*
* @param getAccessToken - Async function that returns current access token
* @param customFetch - Optional custom fetch implementation
* @returns Wrapped fetch function with auth headers
*/
function fetchWithAuth(getAccessToken, customFetch) {
	const baseFetch = customFetch ?? fetch;
	return async (input, init) => {
		const accessToken = await getAccessToken();
		if (!accessToken) throw new AuthRequiredError();
		const headers = new Headers(init?.headers);
		if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${accessToken}`);
		return baseFetch(input, {
			...init,
			headers
		});
	};
}

//#endregion
//#region src/client/client-factory.ts
/**
* Factory function to create NeonClient with seamless auth integration
*
* @param options - Configuration options
* @returns NeonClient instance with auth-aware fetch wrapper
* @throws AuthRequiredError when making requests without authentication
*/
function createClient({ url, auth: authOptions, options }) {
	const auth = new StackAuthAdapter(authOptions);
	const getAccessToken = async () => {
		const { data, error } = await auth.getSession();
		if (error || !data.session) return null;
		return data.session.access_token;
	};
	const authFetch = fetchWithAuth(getAccessToken, options?.global?.fetch);
	const client = new NeonClient({
		url,
		options: {
			...options,
			global: {
				...options?.global,
				fetch: authFetch
			}
		}
	});
	client.auth = auth;
	return client;
}

//#endregion
export { AuthApiError, AuthError, NeonClient, StackAuthAdapter, createClient, isAuthError };