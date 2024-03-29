import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { UserDetailsComponent } from './user-details.component';

const routes: Routes = [
  {
    path: '',
    children: [
      {
        path: '',
        component: UserDetailsComponent
      }
    ]
  }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class UserDetailsRoutingModule {}
