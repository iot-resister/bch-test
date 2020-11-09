import { IResolvers } from "graphql-tools";
import jwt from "jsonwebtoken";
import {
  ArgumentNode,
  buildSchema,
  DirectiveNode,
  GraphQLField,
  GraphQLSchema,
} from "graphql";
import * as fs from "fs";
import { Context, DecodedToken } from "./types/interfaces";
import jwkToPem from "jwk-to-pem";
import sinon from "sinon";

interface BuildSchemaResult extends GraphQLSchema {
  _mutationType: {
    _fields: {
      [key: string]: GraphQLField<any, any>;
    };
  };
  _queryType: {
    _fields: {
      [key: string]: GraphQLField<any, any>;
    };
  };
}

const getPrivateFields = (typeDefs: string) => {
  const {
    _queryType: { _fields: queryFields },
  } = buildSchema(typeDefs) as BuildSchemaResult;
  const {
    _mutationType: { _fields: mutationFields },
  } = buildSchema(typeDefs) as BuildSchemaResult;

  const getFields = (fields: {
    [key: string]: GraphQLField<any, any>;
  }): string[] =>
    Object.keys(fields).filter((k) => {
      const directives = fields[k].astNode!.directives!;
      const privateDirectives = (d: DirectiveNode) => d.name.value === "public";
      return !(directives.filter(privateDirectives).length > 0);
    });

  return {
    queryFields: getFields(queryFields),
    mutationFields: getFields(mutationFields),
  };
};

type middleware = (
  root: never,
  args: never,
  context: Context,
  info: never
) => Promise<middleware>;
const authenticateGuard = (next: middleware) => async (
  root: never,
  args: never,
  context: Context,
  info: never
) => {
  const token = context.headers.authorization;
  const {
    keys: [jwk],
  } = JSON.parse(fs.readFileSync("certs.json").toString());
  const pem = jwkToPem(jwk);
  const { sub } = (await jwt.verify(token, pem)) as DecodedToken;
  context.userId = sub;
  return next(root, args, context, info);
};

export const applyAuthenticationGuard = (
  resolvers: IResolvers,
  typeDefs: string
) => {
  const { queryFields, mutationFields } = getPrivateFields(typeDefs);
  const { Query, Mutation } = resolvers;

  const updateResolver = (rootType: any, fields: any) => {
    //  PERF: mutable object performs ~300ms then user Object.keys(rootType).reduce...
    for (const key in rootType) {
      if (fields.includes(key)) {
        rootType[key] = authenticateGuard(rootType[key]);
      }
    }
  };
  updateResolver(Mutation, mutationFields);
  updateResolver(Query, queryFields);
};
