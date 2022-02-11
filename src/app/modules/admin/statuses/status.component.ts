import { Route, Router } from '@angular/router';
import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { AddOrUpdate } from '../pages/departaments/model/add-or-update';
import { Status } from './model/status';
import { StatusService } from './services/status.service';
const ELEMENT_DATA: Location[] = [
];
@Component({
  selector: 'app-status',
  templateUrl: './status.component.html',
  styleUrls: ['./status.component.scss']
})
export class StatusComponent implements OnInit {
    displayedColumns: string[] = ['position', 'name', 'color','edit', 'delete'];
    dataSource = ELEMENT_DATA;
    constructor(
        private _statusService: StatusService,
        private _fuseConfirmationService: FuseConfirmationService,
        private _snackBar: MatSnackBar,
        private _router: Router
    ) { }

    ngOnInit(): void {
        this.getStatuses();
    }
    parentFunction(data: AddOrUpdate): void{
        console.log(data);
        console.log(data,'parentFunction');
        if(!data.isUpdate){
            this.dataSource.unshift(data.data);
            this.dataSource = [...this.dataSource];
        }else{
            this.getStatuses();
        }
    }
    getStatuses(): any{
        this._statusService._getStatus().subscribe((res: any)=>{
            this.dataSource = res.data;
        },(err: any)=>{
            console.log(err);
        });
    }




    deleteStatus($id: number, $rowNumber: number): void{
        const dialogRef = this._fuseConfirmationService.open();
        // Subscribe to afterClosed from the dialog reference
        dialogRef.afterClosed().subscribe((result) => {
            console.log(result);
            if(result === 'confirmed'){
                this._statusService._deleteStatus($id).subscribe((res: any)=>{
                    this.dataSource.splice($rowNumber, 1);
                    this.dataSource = [...this.dataSource];
                    this._snackBar.open('Deleted successfuly!', 'close', {
                        duration: 3000,
                    });
                },(err: any)=>{
                    console.log(err);
                });
            }
        });
    }

    navigateTo(id: number): void{
        this._router.navigate([`/status/${id}`]);

    }
}