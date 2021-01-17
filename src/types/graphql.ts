export type Maybe<T> = T | null;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  URL: any;
  EmailAddress: any;
  UUID: any;
};





export enum Status {
  Success = 'SUCCESS',
  Failure = 'FAILURE',
  DoesNotExist = 'DOES_NOT_EXIST'
}

export type User = {
  __typename?: 'User';
  email: Scalars['EmailAddress'];
  id: Scalars['UUID'];
  avatarURL: Scalars['URL'];
};

export type Query = {
  __typename?: 'Query';
  status: Status;
  signIn: User;
  sendForgotPasswordEmail: Status;
  signOut: Status;
};


export type QuerySignInArgs = {
  input: CredentialsInput;
};


export type QuerySendForgotPasswordEmailArgs = {
  email?: Maybe<Scalars['String']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  signUp: User;
  resetPassword: Status;
  updateUser: User;
  deleteUser: Scalars['String'];
};


export type MutationSignUpArgs = {
  input: CredentialsInput;
};


export type MutationResetPasswordArgs = {
  id?: Maybe<Scalars['UUID']>;
  input?: Maybe<ResetPasswordInput>;
};


export type MutationUpdateUserArgs = {
  id?: Maybe<Scalars['UUID']>;
  input?: Maybe<UpdateUserInput>;
};


export type MutationDeleteUserArgs = {
  id?: Maybe<Scalars['UUID']>;
};

export type CredentialsInput = {
  email: Scalars['EmailAddress'];
  password: Scalars['String'];
};

export type UpdateUserInput = {
  email?: Maybe<Scalars['EmailAddress']>;
  avatarURL?: Maybe<Scalars['URL']>;
};

export type ResetPasswordInput = {
  oldPassword?: Maybe<Scalars['String']>;
  newPassword: Scalars['String'];
};
