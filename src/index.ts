import express, { Response } from "express";
import { graphqlHTTP } from "express-graphql";
import { IResolvers, makeExecutableSchema } from "graphql-tools";
import { readFileSync } from "fs";
import {
  QuerySignInArgs,
  MutationSignUpArgs,
  User,
  MutationDeleteUserArgs,
  Status,
} from "./types/graphql";
import Provider from "./identityProvider";
import { GraphQLEmailAddress, GraphQLURL, GraphQLUUID } from "graphql-scalars";
import { Context } from "./types/interfaces";
import { applyAuthenticationGuard } from "./authenticationGuard";

import * as Sentry from "@sentry/node";

Sentry.init({ dsn: "" });

const scalars = {
  URL: GraphQLURL,
  EmailAddress: GraphQLEmailAddress,
  UUID: GraphQLUUID,
};

const queries = {
  status: (): string => "SUCCESS",
  signIn: async (
    _: never,
    { input }: QuerySignInArgs,
    { provider }: Context
  ): Promise<User> => provider.signIn(input),
};

const mutations = {
  signUp: async (
    _: never,
    { input }: MutationSignUpArgs,
    { provider }: Context
  ): Promise<User> => provider.signUp(input),
  deleteUser: async (
    _: never,
    { id }: MutationDeleteUserArgs,
    { provider }: Context
  ): Promise<String> => provider.deleteUser(id),
};

// const resolvers: IResolvers = {
//   ...scalars,
//   Query: queries,
//   Mutation: mutations,
// };

const typeDefs = readFileSync("schema.graphql").toString();

applyAuthenticationGuard(resolvers, typeDefs);

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

interface IncomingMessage {
  rawBody: any;
}

const app = express();

app.use(express.json());

app.use(
  "/graphql",
  graphqlHTTP(async (req, res) => {
    const provider = new Provider(res as Response);
    return { schema, context: { ...req, provider } };
  })
);

const { PORT } = process.env;

app.listen(PORT);

export default app;
