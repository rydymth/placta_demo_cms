import { Routes } from '@angular/router';
import { PublicPageComponent } from './public-page';
import { AboutCmsComponent } from './about-cms';

export const routes: Routes = [
  { path: 'about', component: AboutCmsComponent },
  { path: '', component: PublicPageComponent },
  { path: ':slug', component: PublicPageComponent },
  { path: '**', component: PublicPageComponent },
];
