import { Client, Issuer } from "openid-client";
import { Response } from "express";
import {
  CredentialsInput,
  ResetPasswordInput,
  Status,
  UpdateUserInput,
  User,
} from "./types/graphql";
import * as request from "request-promise";
import jwtDecode from "jwt-decode";
import { DecodedToken } from "./types/interfaces";

interface Opts {
  method: "post" | "put" | "get" | "delete";
  uri: string;
  body?: {
    [key: string]: unknown;
  };
}

abstract class Provider {
  abstract async signUp(input: CredentialsInput): Promise<User>;
  abstract async signIn(input: CredentialsInput): Promise<User>;
  abstract async resetPassword(
    id: string,
    input: ResetPasswordInput
  ): Promise<Status>;
  abstract async updateUser(id: string, input: UpdateUserInput): Promise<User>;
  abstract async deleteUser(id: string): Promise<Status>;
  // abstract async sendForgotPasswordEmail(id: string): Promise<Status>;
}

const { KEYCLOAK_URL, KEYCLOAK_PW, MINIO_URL } = process.env;
// helpers
const publish = (topic: string, payload: { [key: string]: string }) => {
  return { topic, payload };
};

const getAdminToken = async () => {
  const keycloakIssuer = new Issuer({
    token_endpoint: `${KEYCLOAK_URL}/auth/realms/swaystore/protocol/openid-connect/token`,
    issuer: "https://keycloak.resistr.life/auth/realms/swaystore",
  });
  const client = new keycloakIssuer.Client({
    client_id: "admin-cli",
    client_secret: "none",
  });
  let tokenSet = await client.grant({
    grant_type: "password",
    username: "resister",
    password: KEYCLOAK_PW,
  });
  return { tokenSet, client };
};

let adminToken: string;
(async () => {
  const { tokenSet, client } = await getAdminToken();
  adminToken = tokenSet.access_token!;
  setInterval(async () => {
    const { access_token } = await client.refresh(tokenSet);
    adminToken = access_token!;
  }, 58000);
})();

const avatarURL = (id: string): string =>
  `${MINIO_URL}/users/${id}/avatarURL/${id}.png`;

export const getUserToken = async (
  email: string,
  password: string
): Promise<string> => {
  const tokenPayload = await request.post(
    `${KEYCLOAK_URL}/auth/realms/swaystore/protocol/openid-connect/token`,
    {
      form: {
        username: email,
        password,
        grant_type: "password",
        client_id: "webapp",
      },
    }
  );
  const { access_token } = JSON.parse(tokenPayload);
  return access_token;
};

export default class KeycloakProvider implements Provider {
  constructor(private res: Response) {}

  async resetPassword(
    id: string,
    { newPassword }: ResetPasswordInput
  ): Promise<any> {
    await KeycloakProvider.callAdminAPI({
      method: "put",
      uri: `${id}/reset-password`,
      body: { value: newPassword, type: "password" },
    });
    return Status.Success;
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    const { email, ...attributes } = input;
    await KeycloakProvider.callAdminAPI({
      uri: id,
      method: "put",
      body: { email, username: email, attributes },
    });
    return { email, id, avatarURL: avatarURL(id) };
  }

  async signUp({ email, password }: CredentialsInput): Promise<User> {
    const id = await KeycloakProvider.createUser(email);
    await this.resetPassword(id, { newPassword: password });
    await this.updateUser(id, { avatarURL: avatarURL(id), email });
    const accessToken = await getUserToken(email, password);
    this.res.header("Authorization", accessToken);
    publish("minio.users", { avatarURL: avatarURL(id) });
    return { id, email, avatarURL: avatarURL(id) };
  }

  async signIn({ email, password }: CredentialsInput): Promise<User> {
    const accessToken = await getUserToken(email, password);
    const { sub: id } = jwtDecode(accessToken) as DecodedToken;
    this.res.header("Authorization", accessToken);
    return { email, id, avatarURL: avatarURL(id) };
  }

  async deleteUser(id: string): Promise<Status> {
    await KeycloakProvider.callAdminAPI({
      method: "delete",
      uri: id,
    });
    return Status.Success;
  }

  private static async callAdminAPI({ method, uri, body }: Opts) {
    if (!adminToken) {
      const { tokenSet } = await getAdminToken();
      adminToken = tokenSet.access_token!;
    }
    return await request[method]({
      resolveWithFullResponse: true,
      uri: `${KEYCLOAK_URL}/auth/admin/realms/swaystore/users/${uri}`,
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
    });
  }
  private static async createUser(email: string): Promise<any> {
    const res = await KeycloakProvider.callAdminAPI({
      uri: "",
      method: "post",
      body: { email, username: email, enabled: true },
    });
    return res.headers.location.split("/").pop();
  }
}
