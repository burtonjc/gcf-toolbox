export class GcloudCLINotInstalled extends Error {
  message = 'gcloud cli not installed. Please follow the instructions at https://cloud.google.com/sdk/docs/#install_the_latest_cloud_tools_version_cloudsdk_current_version to install it.';
}

export class NoProjectSpecifiedError extends Error {
  message = 'You must specify a project or set a defaultProject';
}

export class ProjectNotFoundInConfigError extends Error {
  message = 'Specified project does not exist in config.json';
}
