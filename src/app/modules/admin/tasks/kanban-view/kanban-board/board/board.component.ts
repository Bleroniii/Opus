import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { combineLatest, map, shareReplay, Subject, takeUntil, tap } from 'rxjs';
import * as moment from 'moment';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { ScrumboardService } from '../scrumboard.service';
import { Board, Card, List } from '../scrumboard.models' 
import { TasksService } from '../../../tasks.service';
import { environment } from 'environments/environment';
import { Boards } from '../../../../departments/departments.types';
@Component({
    selector       : 'scrumboard-board',
    templateUrl    : './board.component.html',
    styleUrls      : ['./board.component.scss'],
    encapsulation  : ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScrumboardBoardComponent implements OnInit, OnDestroy
{
    board: Boards;
    listTitleForm: FormGroup;
    apiUrl = environment.apiUrl;


    tasksData$ = combineLatest([
        this._taskService.currentBoardTasks$,
        this._taskService.newTask$,
        this._taskService.taskUpdated$,
        this._taskService.deletedTask$
    ],(g,p,u,d) => {
         if(p){
            const id = g.findIndex(t=> t.id === p.id);
            if(id === -1){
                g.push(p);
            }
         }
         else if(u){
            const id = g.findIndex(t=> t.id === u.id);
            if(id > -1){
                g.splice(id,1,u);
            }
         }else if(d){
                const deletedTask = g.findIndex(t => t.id === +d.id)
                if(deletedTask > -1){
                    g.splice(deletedTask,1);
                }
         }
       return g;
     }); 

        
     tasksDataCheckList$= combineLatest([
        this.tasksData$,
        this._taskService.newCheckList$,
        this._taskService.udatedCheckList$,
        this._taskService.deletedCheckList$
    ],(tasksWithDepartment,newCL,updatedCL,deletedCL) => {
            if(newCL){
                tasksWithDepartment.find(t=>t.id === newCL.task_id)?.checklists.push(newCL);
            }else if(updatedCL){
                const taskIndex = tasksWithDepartment.findIndex(t=>t.id === updatedCL.task_id);
                if(taskIndex > -1){
                    const checkListIndex = tasksWithDepartment[taskIndex].checklists.findIndex(c => c.id === updatedCL.id);
                    if(checkListIndex > -1){
                        tasksWithDepartment[taskIndex].checklists.splice(checkListIndex,1,updatedCL);
                    }
                }
            }else if(deletedCL){
                const taskIndex = tasksWithDepartment.findIndex(t=>t.id === deletedCL.task_id);
                const checkListIndex = tasksWithDepartment[taskIndex].checklists.findIndex(c => c.id === deletedCL.id);
                if(checkListIndex > -1){
                    tasksWithDepartment[taskIndex].checklists.splice(checkListIndex,1);
                }
            }
        return tasksWithDepartment;
    });

    usersAssigned$ = combineLatest([
        this.tasksDataCheckList$,
        this._taskService.getStatus$,
        this._taskService.getPriorities$,
        this._taskService.getUsersData$
      ]).pipe(
        map(([currentBoardTasks, getStatus, getPriorities, getUsersData]) =>(
               getStatus.map(s=>({
                    status : s,
                    tasks: currentBoardTasks.filter(x=>x.status === s.id).map(_tasks=>({
                        ..._tasks,
                        priority: getPriorities.find(x=>x.id === _tasks.priority),
                        users_assigned: _tasks.users_assigned.map(u => (
                            getUsersData.find(user => u === +user.id)
                        )),
                        checkListInfo : {
                            completed: _tasks.checklists.filter(x => x.value === 1).length,
                            total: _tasks.checklists.length
                        }
                    })),
                }
               ))
        )),
        shareReplay(1),
        tap(res=>console.log(res)
        )
        );

       
     
    // Private
    private readonly _positionStep: number = 65536;
    private readonly _maxListCount: number = 200;
    private readonly _maxPosition: number = this._positionStep * 500;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    /**
     * Constructor
     */
    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _formBuilder: FormBuilder,
        private _fuseConfirmationService: FuseConfirmationService,
        private _scrumboardService: ScrumboardService,
        private _taskService: TasksService
    )
    {
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void
    {
        // Initialize the list title form
        this.listTitleForm = this._formBuilder.group({
            title: ['']
        });

        this._taskService.currentBoard$.pipe(takeUntil(this._unsubscribeAll))
        .subscribe((board: Boards) => {
            
            this.board = {...board};

            // Mark for check
            this._changeDetectorRef.markForCheck();
        });
        // Get the board
        
    }

    /**
     * On destroy
     */
    ngOnDestroy(): void
    {
        // Unsubscribe from all subscriptions
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Focus on the given element to start editing the list title
     *
     * @param listTitleInput
     */
    renameList(listTitleInput: HTMLElement): void
    {
        // Use timeout so it can wait for menu to close
        setTimeout(() => {
            listTitleInput.focus();
        });
    }

    /**
     * Add new list
     *
     * @param title
     */
    // addList(title: string): void
    // {
    //     // Limit the max list count
    //     if ( this.board.lists.length >= this._maxListCount )
    //     {
    //         return;
    //     }

    //     // Create a new list model
    //     const list = new List({
    //         boardId : this.board.id,
    //         position: this.board.lists.length ? this.board.lists[this.board.lists.length - 1].position + this._positionStep : this._positionStep,
    //         title   : title
    //     });

    //     // Save the list
    //     this._scrumboardService.createList(list).subscribe();
    // }

    /**
     * Update the list title
     *
     * @param event
     * @param list
     */
    updateListTitle(event: any, list: List): void
    {
        // Get the target element
        const element: HTMLInputElement = event.target;

        // Get the new title
        const newTitle = element.value;

        // If the title is empty...
        if ( !newTitle || newTitle.trim() === '' )
        {
            // Reset to original title and return
            element.value = list.title;
            return;
        }

        // Update the list title and element value
        list.title = element.value = newTitle.trim();

        // Update the list
        this._scrumboardService.updateList(list).subscribe();
    }

    /**
     * Delete the list
     *
     * @param id
     */
    deleteList(id): void
    {
        // Open the confirmation dialog
        const confirmation = this._fuseConfirmationService.open({
            title  : 'Delete list',
            message: 'Are you sure you want to delete this list and its cards? This action cannot be undone!',
            actions: {
                confirm: {
                    label: 'Delete'
                }
            }
        });

        // Subscribe to the confirmation dialog closed action
        confirmation.afterClosed().subscribe((result) => {

            // If the confirm button pressed...
            if ( result === 'confirmed' )
            {

                // Delete the list
                this._scrumboardService.deleteList(id).subscribe();
            }
        });
    }

    /**
     * Add new card
     */
    addCard(list: any, title: string): void
    {
        console.log(list, title);
        const newTask = {
            id: null,
            title: title,
            board_id: this.board.id,
            status:list.status.id
        }
        console.log(newTask);
        // Save the card
        this._taskService.storeTask(newTask).subscribe();
    }

    /**
     * List dropped
     *
     * @param event
     */
    listDropped(event: CdkDragDrop<List[]>): void
    {
        // Move the item
        moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);

        // Calculate the positions
        const updated = this._calculatePositions(event);

        // Update the lists
        this._scrumboardService.updateLists(updated).subscribe();
    }

    /**
     * Card dropped
     *
     * @param event
     */
    cardDropped(event: CdkDragDrop<Card[]>): void
    {
        console.log(event,"currentItem.position = this._positionStepcurrentItem.position = this._positionStep");
        // Move or transfer the item
        if ( event.previousContainer === event.container )
        {
            // Move the item
            moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
        }
        else
        {
            
            transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);

            // Update the card's list it
            event.container.data[event.currentIndex].listId = event.container.id;
        }

        // Calculate the positions
        const updated = this._calculatePositions(event);
        const currentTask = event.container.data[event.currentIndex];
        // Update the cards
        this._taskService.updateTaskStatus(event.container.id, +currentTask.id).subscribe();
    }

    /**
     * Check if the given ISO_8601 date string is overdue
     *
     * @param date
     */
    isOverdue(date: string): boolean
    {
        return moment(date, moment.ISO_8601).isBefore(moment(), 'days');
    }

    /**
     * Track by function for ngFor loops
     *
     * @param index
     * @param item
     */
    trackByFn(index: number, item: any): any
    {
        return item.id || index;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Calculate and set item positions
     * from given CdkDragDrop event
     *
     * @param event
     * @private
     */
    private _calculatePositions(event: CdkDragDrop<any[]>): any[]
    {
        // Get the items
        let items = event.container.data;
        const currentItem = items[event.currentIndex];
        const prevItem = items[event.currentIndex - 1] || null;
        const nextItem = items[event.currentIndex + 1] || null;

        // If the item moved to the top...
        if ( !prevItem )
        {
            // If the item moved to an empty container
            if ( !nextItem )
            {
                currentItem.position = this._positionStep;
            }
            else
            {
                currentItem.position = nextItem.position / 2;
            }
        }
        // If the item moved to the bottom...
        else if ( !nextItem )
        {
            currentItem.position = prevItem.position + this._positionStep;
        }
        // If the item moved in between other items...
        else
        {
            currentItem.position = (prevItem.position + nextItem.position) / 2;
        }

        // Check if all item positions need to be updated
        if ( !Number.isInteger(currentItem.position) || currentItem.position >= this._maxPosition )
        {
            // Re-calculate all orders
            items = items.map((value, index) => {
                value.position = (index + 1) * this._positionStep;
                return value;
            });

            // Return items
            return items;
        }

        // Return currentItem
        return [currentItem];
    }
}
