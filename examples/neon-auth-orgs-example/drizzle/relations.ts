import { relations } from "drizzle-orm/relations";
import { userInNeonAuth, sessionInNeonAuth, accountInNeonAuth, organizationInNeonAuth, memberInNeonAuth, invitationInNeonAuth } from "./schema";

export const sessionInNeonAuthRelations = relations(sessionInNeonAuth, ({one}) => ({
	userInNeonAuth: one(userInNeonAuth, {
		fields: [sessionInNeonAuth.userId],
		references: [userInNeonAuth.id]
	}),
}));

export const userInNeonAuthRelations = relations(userInNeonAuth, ({many}) => ({
	sessionInNeonAuths: many(sessionInNeonAuth),
	accountInNeonAuths: many(accountInNeonAuth),
	memberInNeonAuths: many(memberInNeonAuth),
	invitationInNeonAuths: many(invitationInNeonAuth),
}));

export const accountInNeonAuthRelations = relations(accountInNeonAuth, ({one}) => ({
	userInNeonAuth: one(userInNeonAuth, {
		fields: [accountInNeonAuth.userId],
		references: [userInNeonAuth.id]
	}),
}));

export const memberInNeonAuthRelations = relations(memberInNeonAuth, ({one}) => ({
	organizationInNeonAuth: one(organizationInNeonAuth, {
		fields: [memberInNeonAuth.organizationId],
		references: [organizationInNeonAuth.id]
	}),
	userInNeonAuth: one(userInNeonAuth, {
		fields: [memberInNeonAuth.userId],
		references: [userInNeonAuth.id]
	}),
}));

export const organizationInNeonAuthRelations = relations(organizationInNeonAuth, ({many}) => ({
	memberInNeonAuths: many(memberInNeonAuth),
	invitationInNeonAuths: many(invitationInNeonAuth),
}));

export const invitationInNeonAuthRelations = relations(invitationInNeonAuth, ({one}) => ({
	organizationInNeonAuth: one(organizationInNeonAuth, {
		fields: [invitationInNeonAuth.organizationId],
		references: [organizationInNeonAuth.id]
	}),
	userInNeonAuth: one(userInNeonAuth, {
		fields: [invitationInNeonAuth.inviterId],
		references: [userInNeonAuth.id]
	}),
}));