import { bootstrapApplication } from '@angular/platform-browser';
import { Component } from '@angular/core';
import { OmniStoreComponent } from './omni-store.component';

@Component({ selector: 'app-root', standalone: true, imports: [OmniStoreComponent], template: '<omni-store />' })
class AppComponent {}

bootstrapApplication(AppComponent).catch((err) => console.error(err));
