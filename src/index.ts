import express, { Response } from "express";
import { config } from "dotenv";
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
import { applyAuthenticationGuard } from "./authentication-guard";

config({ path: `.env.${process.env.NODE_ENV}` });

const app = express();

const resolvers: IResolvers = {
  URL: GraphQLURL,
  EmailAddress: GraphQLEmailAddress,
  UUID: GraphQLUUID,
  Query: {
    status: (): string => "SUCCESS",
    signIn: async (
      _: never,
      { input }: QuerySignInArgs,
      { provider }: Context
    ): Promise<User> => provider.signIn(input),
  },
  Mutation: {
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
  },
};
const typeDefs = readFileSync("schema.graphql").toString();
applyAuthenticationGuard(resolvers, typeDefs);
const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

app.use(
  "/graphql",
  graphqlHTTP(async (req, res) => {
    const provider = await Provider.init(res as Response);
    return { schema, context: { ...req, provider } };
  })
);
const { PORT } = process.env;
app.listen(PORT);

export default app;
