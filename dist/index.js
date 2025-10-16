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
	stackAuth;
	stateChangeEmitters = /* @__PURE__ */ new Map();
	broadcastChannel = null;
	tokenRefreshCheckInterval = null;
	config = {
		enableTokenRefreshDetection: true,
		tokenRefreshCheckInterval: 3e4
	};
	constructor(params, config) {
		if (config) this.config = {
			...this.config,
			...config
		};
		this.stackAuth = params.secretServerKey ? new StackServerApp(params) : new StackClientApp(params);
	}
	admin = void 0;
	mfa = void 0;
	initialize = async () => {
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
	};
	signUp = async (credentials) => {
		try {
			if ("email" in credentials && credentials.email && credentials.password) {
				const result = await this.stackAuth.signUpWithCredential({
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
	};
	signInAnonymously = async () => {
		return {
			data: {
				user: null,
				session: null
			},
			error: new AuthError("Anonymous sign-in is not supported by Stack Auth", 501, "anonymous_provider_disabled")
		};
	};
	signInWithPassword = async (credentials) => {
		try {
			if ("email" in credentials && credentials.email) {
				const result = await this.stackAuth.signInWithCredential({
					email: credentials.email,
					password: credentials.password,
					noRedirect: true
				});
				console.log("result", result);
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
	};
	signInWithOAuth = async (credentials) => {
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
	};
	signInWithOtp = async (credentials) => {
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
	};
	signInWithIdToken = async () => {
		throw new Error("signInWithIdToken not implemented yet");
	};
	signInWithSSO = async () => {
		throw new Error("signInWithSSO not implemented yet");
	};
	signInWithWeb3 = async () => {
		throw new Error("signInWithWeb3 not implemented yet");
	};
	signOut = async () => {
		try {
			const internalSession = await this._getSessionFromStackAuthInternals();
			if (!internalSession) throw new AuthError("No session found", 401, "session_not_found");
			await this.stackAuth._interface.signOut(internalSession);
			await this.notifyAllSubscribers("SIGNED_OUT", null);
			return { error: null };
		} catch (error) {
			return { error: normalizeStackAuthError(error) };
		}
	};
	verifyOtp = async () => {
		throw new Error("verifyOtp not implemented yet");
	};
	getSession = async () => {
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
	};
	refreshSession = async () => {
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
	};
	setSession = async () => {
		return {
			data: {
				user: null,
				session: null
			},
			error: new AuthError("Setting external sessions is not supported by Stack Auth", 501, "not_implemented")
		};
	};
	getUser = async () => {
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
						displayName: user.displayName,
						profileImageUrl: user.profileImageUrl,
						...user.clientMetadata
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
	};
	getClaims = async () => {
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
	};
	updateUser = async (attributes) => {
		try {
			const user = await this.stackAuth.getUser();
			if (!user) return {
				data: { user: null },
				error: new AuthError("No user session found", 401, "session_not_found")
			};
			if (attributes.password) await user.setPassword({ password: attributes.password });
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
					displayName: updatedUser.displayName,
					profileImageUrl: updatedUser.profileImageUrl,
					...updatedUser.clientMetadata
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
	};
	getUserIdentities = async () => {
		throw new Error("getUserIdentities not implemented yet");
	};
	linkIdentity = async () => {
		throw new Error("linkIdentity not implemented yet");
	};
	unlinkIdentity = async () => {
		throw new Error("unlinkIdentity not implemented yet");
	};
	resetPasswordForEmail = async (email, options) => {
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
	};
	reauthenticate = async () => {
		throw new Error("reauthenticate not implemented yet");
	};
	resend = async () => {
		throw new Error("resend not implemented yet");
	};
	onAuthStateChange = (callback) => {
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
	};
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
		if (typeof BroadcastChannel === "undefined") return;
		if (!this.broadcastChannel) {
			this.broadcastChannel = new BroadcastChannel("stack-auth-state-changes");
			this.broadcastChannel.onmessage = async (event) => {
				const { event: authEvent, session } = event.data;
				await this.notifyAllSubscribers(authEvent, session, false);
			};
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
	exchangeCodeForSession = async () => {
		throw new Error("exchangeCodeForSession not implemented yet");
	};
	startAutoRefresh = async () => {};
	stopAutoRefresh = async () => {};
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
//#region src/client/neon-client.ts
var NeonClient = class extends PostgrestClient {
	auth;
	constructor({ url, auth, fetch: customFetch }) {
		super(url, { fetch: customFetch });
	}
};
/**
* Factory function to create NeonClient with seamless auth integration
*
* @param options - Configuration options
* @returns NeonClient instance with auth-aware fetch wrapper
* @throws AuthRequiredError when making requests without authentication
*/
function createClient({ url, auth: authOptions }) {
	const auth = new StackAuthAdapter(authOptions);
	const getAccessToken = async () => {
		const { data, error } = await auth.getSession();
		if (error || !data.session) return null;
		return data.session.access_token;
	};
	const client = new NeonClient({
		url,
		auth: authOptions,
		fetch: fetchWithAuth(getAccessToken)
	});
	client.auth = auth;
	return client;
}

//#endregion
export { AuthApiError, AuthError, NeonClient, StackAuthAdapter, createClient, isAuthError };