import { Issuer } from "openid-client";
import { Response } from "express";
import {
  CredentialsInput,
  Status,
  UpdateUserInput,
  User,
} from "./types/graphql";
import * as request from "request-promise";
import jwtDecode from "jwt-decode";
import { DecodedToken } from "./types/interfaces";

abstract class Provider {
  abstract async signUp(input: CredentialsInput): Promise<User>;
  abstract async signIn(input: CredentialsInput): Promise<User>;
  // abstract async resetPassword(
  //   id: string,
  //   input: ResetPasswordInput
  // ): Promise<Status>;
  abstract async updateUser(id: string, input: UpdateUserInput): Promise<User>;
  abstract async deleteUser(id: string): Promise<Status>;
  // abstract async sendForgotPasswordEmail(id: string): Promise<Status>;
}

const { KEYCLOAK_URL, KEYCLOAK_PW, MINIO_URL } = process.env;

// helpers
const openIdClient = async () => {
  const keycloakIssuer = new Issuer({
    token_endpoint: `${KEYCLOAK_URL}/auth/realms/swaystore/protocol/openid-connect/token`,
    issuer: "https://keycloak.resistr.life/auth/realms/swaystore",
  });
  return new keycloakIssuer.Client({
    client_id: "admin-cli",
    client_secret: "none",
  });
};

const getUserToken = async (
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
  constructor(private adminToken: string, private res: Response) {}

  // This method sets an interval to always have an admin token available for every method's api call
  static async init(res: Response) {
    const client = await openIdClient();

    let tokenSet = await client.grant({
      grant_type: "password",
      username: "resister",
      password: KEYCLOAK_PW,
    });

    // sets initial token
    let adminToken = tokenSet.access_token;

    // start interval
    setInterval(async () => {
      const { access_token } = await client.refresh(tokenSet);
      adminToken = access_token;
    }, 58 * 100);

    // recursively create instance
    return new KeycloakProvider(adminToken as string, res);
  }

  async signUp({ email, password }: CredentialsInput): Promise<User> {
    const res = await request.post(
      `${KEYCLOAK_URL}/auth/admin/realms/swaystore/users`,
      {
        resolveWithFullResponse: true,
        body: JSON.stringify({ email, username: email, enabled: true }),
        headers: {
          Authorization: `Bearer ${this.adminToken}`,
          "content-type": "application/json",
        },
      }
    );
    const id = res.headers.location.split("/").pop();
    await request.put(
      `${KEYCLOAK_URL}/auth/admin/realms/swaystore/users/${id}/reset-password`,
      {
        body: JSON.stringify({ value: password, type: "password" }),
        headers: {
          Authorization: `Bearer ${this.adminToken}`,
          "content-type": "application/json",
        },
      }
    );

    await this.updateUser(id, { avatarURL: avatarURL(id) });

    const accessToken = await getUserToken(email, password);
    this.res.header("Authorization", accessToken);
    return {
      email,
      avatarURL: avatarURL(id),
      id,
    };
  }
  async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    const { email, ...rest } = input;
    let body = { email, username: email, attributes: rest };
    await request.put(
      `${KEYCLOAK_URL}/auth/admin/realms/swaystore/users/${id}`,
      {
        resolveWithFullResponse: true,
        body: JSON.stringify(body),
        headers: {
          Authorization: `Bearer ${this.adminToken}`,
          "content-type": "application/json",
        },
      }
    );
    return { email, id, avatarURL: avatarURL(id) };
  }
  async signIn({ email, password }: CredentialsInput): Promise<User> {
    const accessToken = await getUserToken(email, password);
    const { sub: id } = jwtDecode(accessToken) as DecodedToken;

    const user = await request.get(
      `${KEYCLOAK_URL}/auth/admin/realms/swaystore/users/${id}`,
      {
        headers: { Authorization: `Bearer ${this.adminToken}` },
      }
    );

    const { attributes } = JSON.parse(user);
    this.res.header("Authorization", accessToken);
    return { email, id, avatarURL: attributes.avatarURL };
  }
  async deleteUser(id: string): Promise<Status> {
    await request.delete(
      `${KEYCLOAK_URL}/auth/admin/realms/swaystore/users/${id}`,
      {
        headers: {
          Authorization: `Bearer ${this.adminToken}`,
        },
      }
    );
    return Status.Success;
  }
}

const avatarURL = (id: string): string =>
  `${MINIO_URL}/users/${id}/avatarURL/${id}.png`;
