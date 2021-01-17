import supertest from "supertest";
import app from "../src";
import { strict as assert } from "assert";
import { ASTNode, print } from "graphql";
import gql from "graphql-tag";
import nock = require("nock");
import jwtDecode from "jwt-decode";
import { DecodedToken, ProcessEnv } from "../src/types/interfaces";
import { User } from "../src/types/graphql";
import sinon from "sinon";
import jwt from "jsonwebtoken";

const { E2E, KEYCLOAK_URL, MINIO_URL } = process.env as ProcessEnv;

// fake data
let access_token =
  "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJFN3ltM2ZXend3VmRyWTJIS2RHMEFVSHRzZGpWZUduekZacVdHekhSbnkwIn0.eyJleHAiOjE2MDQ4ODEyMDEsImlhdCI6MTYwNDg4MDkwMSwianRpIjoiMzkyN2Y1ODctMWIyMS00ODk5LTgwNmEtN2RhMzZmMTMwYjc0IiwiaXNzIjoiaHR0cHM6Ly9rZXljbG9hay5yZXNpc3RyLmxpZmUvYXV0aC9yZWFsbXMvc3dheXN0b3JlIiwiYXVkIjoiYWNjb3VudCIsInN1YiI6IjBhMmFjNWYyLWQyNTgtNDZjMS1iM2ZiLWQ3NTVkY2Y5YWRmMSIsInR5cCI6IkJlYXJlciIsImF6cCI6IndlYmFwcCIsInNlc3Npb25fc3RhdGUiOiJjMTVhZTBiNS1mNGI5LTQ1ZTEtYTdhYy1jYTFmNzE2MGEzYjMiLCJhY3IiOiIxIiwicmVhbG1fYWNjZXNzIjp7InJvbGVzIjpbIm9mZmxpbmVfYWNjZXNzIiwidW1hX2F1dGhvcml6YXRpb24iXX0sInJlc291cmNlX2FjY2VzcyI6eyJhY2NvdW50Ijp7InJvbGVzIjpbIm1hbmFnZS1hY2NvdW50IiwibWFuYWdlLWFjY291bnQtbGlua3MiLCJ2aWV3LXByb2ZpbGUiXX19LCJzY29wZSI6InByb2ZpbGUgZW1haWwiLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsInByZWZlcnJlZF91c2VybmFtZSI6ImRlbW9AZGVtby5jbyIsImVtYWlsIjoiZGVtb0BkZW1vLmNvIn0.ChPZ3ShGpytGEi40K3IGJjnAXsZv6Q8rcJcDmVNnZ6Ez-O8HoN1xm-RoOTijyHYBAUs8hL9IvJnd65LQWM2mJUjbGNjKl4AB2doWRFMJCalOiuQofolLBgYd2jhBX_XeyDnv7QAGtc27-g9MI_fpFQZFZyrscA-xi1CudEJHf02wF5gxhznaIhx5UojpEKtUOujsHOV3waHh7iu6SKj_2wEJpyfu2X6tVbp6LY2vacOQSjwtSgBPpq-aeb9gGqQvJ-tVZIH5OCgY9pIIjp8UVY9FGKmT8NjvjuJYXUnXJI9KLkN9o0CKFHYoNDixx92eGZBWI1mApx_wtUv1k3uAtA";
const password = "demo";
const email = "demo@demo.co";
const id = "0a2ac5f2-d258-46c1-b3fb-d755dcf9adf1";
let user: User = {
  email,
  avatarURL: `${MINIO_URL}/users/${id}/avatarURL/${id}.png`,
  id,
};

// mocks
if (!E2E) {
  sinon.mock(jwt).expects("verify").returns(access_token);
  nock(KEYCLOAK_URL)
    .persist()
    .post("/auth/realms/swaystore/protocol/openid-connect/token")
    .reply(200, { access_token })
    .post("/auth/admin/realms/swaystore/users/")
    .reply(200, {}, { location: `/${user.id}` })
    .put(`/auth/admin/realms/swaystore/users/${user.id}`)
    .reply(200)
    .put(`/auth/admin/realms/swaystore/users/${user.id}/reset-password`)
    .reply(200)
    .get(`/auth/admin/realms/swaystore/users/${user.id}`)
    .reply(
      200,
      JSON.stringify({
        attributes: { avatarURL: [user.avatarURL] },
      })
    )
    .delete(`/auth/admin/realms/swaystore/users/${user.id}`)
    .reply(200);
}
const getData = async (query: ASTNode) => {
  const { body, header } = await supertest(app)
    .post("/graphql")
    .send({ query: print(query) })
    .set("Authorization", access_token);
  if (body.errors) {
    throw new Error(body.errors[0].message);
  }
  return { data: body.data, header };
};

it("should return SUCCESS when status is queried", async () => {
  const query = gql`
    {
      status
    }
  `;
  const {
    data: { status },
  } = await getData(query);
  assert.equal(status, "SUCCESS");
});

it("should return an access token and new User when signUp is called", async () => {
  const query = gql`
    mutation {
      signUp(input: { email: "${email}", password: "${password}" }) {
        email,
        id
        avatarURL
      }
    }
  `;
  const {
    data: { signUp },
    header: { authorization },
  } = await getData(query);
  user = signUp as User;
  const { sub } = jwtDecode(authorization) as DecodedToken;
  access_token = authorization;
  assert.equal(user.id, sub);
  assert.equal(user.email, email);
});

it("should return an access token and User type when signIn is called", async () => {
  const query = gql`
    {
      signIn(input: { email: "${user.email}", password: "${password}" }) {
        email,
        id
        avatarURL
      }
    }
  `;
  const {
    data: { signIn: actualUser },
    header: { authorization },
  } = await getData(query);
  const { sub } = jwtDecode(authorization) as DecodedToken;
  assert.equal(user.id, sub);
  assert.deepEqual(actualUser, user);
});

it("should return SUCCESS  when user is deleted", async () => {
  const query = gql`
    mutation {
      deleteUser(id:"${user.id}")
    }
  `;
  const {
    data: { deleteUser },
  } = await getData(query);
  assert.equal(deleteUser, "SUCCESS");
});
