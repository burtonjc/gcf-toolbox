export class NoProjectSpecifiedError extends Error {
  message = "You must specify a project or set a defaultProject";
}

export class ProjectNotFoundInConfigError extends Error {
  message = "Specified project does not exist in config.json";
}
