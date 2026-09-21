import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

console.log = () => {};
bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
