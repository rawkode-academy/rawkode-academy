import { Container, dag, func, object, Secret } from "@dagger.io/dagger";

@object()
export class Gitlab {
  /**
   * Posts a comment to a GitLab Merge Request.
   *
   * @param apiToken Secret containing the GitLab token for posting comments.
   * @param gitlabHost The GitLab host URL.
   * @param repository The GitLab repository in the format "namespace/repository".
   * @param mergeRequestId The ID of the Merge Request.
   * @param comment The content of the comment to post.
   */
  @func()
  async postMergeRequestComment(
    apiToken: Secret,
    mergeRequestId: string,
    comment: string,
    gitlabHost: string = "https://code.rawkode.academy",
    repository: string = "RawkodeAcademy/RawkodeAcademy",
  ): Promise<Container> {
    return dag
      .container()
      .from("gitlab/glab:v1.57.0")
      .withSecretVariable("GITLAB_TOKEN", apiToken)
      .withEnvVariable("GITLAB_HOST", gitlabHost)
      .withExec([
        "glab",
        "mr",
        "note",
        mergeRequestId,
        "-R",
        repository,
        "-m",
        comment,
        "--unique",
      ]);
  }
}
