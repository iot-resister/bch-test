/* eslint-disable import/no-unresolved */
// noinspection NpmUsedModulesInstalled
import { sleep } from "k6";
// noinspection NpmUsedModulesInstalled
import http from "k6/http";

export const options = {
  duration: "1m",
  vus: 50,
  thresholds: {
    http_req_duration: ["p(95)<25"], // 95 percent of response times must be below 30ms
  },
};
export default function () {
  http.post(
    // eslint-disable-next-line no-undef
    `http://${__ENV.HOSTNAME}:${__ENV.PORT || ""}/graphql`,
    JSON.stringify({ query: "{status}" })
  );
  sleep(3);
}
