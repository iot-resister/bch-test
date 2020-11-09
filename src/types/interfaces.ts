import Provider from "../identityProvider";

export interface Context {
  provider: Provider;
  userId: string;
  headers: {
    authorization: string;
  };
}
export interface DecodedToken {
  sub: string;
}
export interface ProcessEnv {
  [key: string]: string;
}
