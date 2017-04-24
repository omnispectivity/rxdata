import { Observable } from 'rxjs';
import { ICollection, IQuery } from '../';
import { ExtendedQuery } from './query';
import { SingleDocQuery } from '../query';
import { FilterOptions } from '../doc-utilities/filter-documents';
import { mergeDocumentArrays } from '../doc-utilities/merge-documents';

/**
 * ExtendedCollection
 * ...
 */
export class ExtendedCollection implements ICollection {
    /**
     * _filterParent
     * ...
     */
    private _filterParent: Function;

    /**
     * _filterChild
     * ...
     */
    private _filterChild: Function;

    /**
     * constructor
     * ...
     */
    constructor( protected parent: ICollection, protected child: ICollection, protected fields: String[]) {
        this._filterParent = key => key === 'id' || this.fields.indexOf( key ) === -1;
        this._filterChild = key => key === 'id' || this.fields.indexOf( key ) !== -1;
    }

    /**
     * find
     * ...
     */
    public find( filter: any, options: FilterOptions = {}): IQuery {
        const parentQuery = this.parent.find( this._pickSubDocument( this._filterParent, filter ));
        const childQuery = this.child.find( this._pickSubDocument( this._filterChild, filter ), options );
        return new ExtendedQuery( parentQuery, childQuery, this.fields );
    }

    /**
     * findOne
     * ...
     */
    public findOne( filter: any, options: FilterOptions = {}): IQuery {
        const findOneOptions = Object.assign( options, { limit: 1 });
        const query = this.find( filter, findOneOptions );
        return new SingleDocQuery( query );
    }

    /**
     * insert
     * ...
     */
    public insert( docOrDocs: any ): Observable<any[]> {
        const docsArray = [].concat( docOrDocs );
        const parentDocs = docsArray.map( doc => this._pickSubDocument( this._filterParent, doc ));
        const childDocs = docsArray.map( doc => this._pickSubDocument( this._filterChild, doc ));
        return Observable
            .combineLatest(
                this.parent.insert( parentDocs ),
                this.child.insert( childDocs ),
            )
            .map( sets => this._mergeDocumentArrays( ...sets ));
    }

    /**
     * update
     * ...
     */
    public update( filter: any, changes: any ): Observable<any[]> {
        return Observable
            .combineLatest(
                this.parent.update( filter, this._pickSubChanges( this._filterParent, changes )),
                this.child.update( filter, this._pickSubChanges( this._filterChild, changes )),
            )
            .map( sets => this._mergeDocumentArrays( ...sets ));
    }

    /**
     * remove
     * ...
     */
    public remove( filter: any ): Observable<any[]> {
        return Observable
            .combineLatest(
                this.parent.remove( filter ),
                this.child.remove( filter ),
            )
            .map( sets => this._mergeDocumentArrays( ...sets ));
    }

    /**
     * unsub
     * ...
     */
    public unsub(): Observable<any> {
        return Observable.of();
    }

    /**
     * _pickSubDocument
     * ...
     */
    protected _pickSubDocument( filter: Function, doc: any ): any {
        return Object.keys( doc )
            .filter( key => filter( key ))
            .reduce(
                ( result, key ) => Object.assign( result, { [ key ]: doc[ key ] }),
                {},
            );
    }

    /**
     * _pickSubChanges
     * ...
     */
    protected _pickSubChanges( filter: Function, changes: any ): any {
        return Object.keys( changes )
            .reduce(
                ( result, operator ) => {
                    const opChanges = this._pickSubDocument( filter, changes[ operator ]);
                    return Object.assign( result, { [ operator ]: opChanges });
                },
                {},
            );
    }

    /**
     * _mergeDocumentArrays
     * ...
     */
    protected _mergeDocumentArrays( ...sets: any[][]): any[] {
        return mergeDocumentArrays( ...sets );
    }
}
