import { Observable } from 'rxjs';
import { ICollection, IQuery } from './';
import { FilterOptions } from './collection';
import { ExtendedQuery } from './extended-query';

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
        const parentQuery = this.parent.find( filter, undefined );
        const childQuery = this.child.find( filter, options );
        return new ExtendedQuery( parentQuery, childQuery, this.fields );
    }

    /**
     * insert
     * ...
     */
    public insert( doc: any ): Observable<any> {
        return Observable
            .combineLatest(
                this.parent.insert( this._pickSubDocument( this._filterParent, doc )),
                this.child.insert( this._pickSubDocument( this._filterChild, doc )),
            )
            .map( docs => this._mergeDocuments( ...docs ));
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
     * _mergeDocumentArrays
     * ...
     */
    protected _mergeDocumentArrays( ...sets: any[][]): any[] {
        const groups = {};
        sets.forEach( set => {
            set.forEach( doc => {
                groups[ doc.id ] = ( groups[ doc.id ] || []).concat( doc );
            });
        });
        return Object.keys( groups )
            .filter( id => groups[id].length === sets.length )
            .map( id => this._mergeDocuments( ...groups[id]));
    }

    /**
     * _mergeDocuments
     * ...
     */
    protected _mergeDocuments( ...docs: any[]): any {
        return Object.assign({}, ...docs );
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
                    const opChanges = this._pickSubDocument( filter, result[ operator ]);
                    return Object.assign( result, { [ operator ]: opChanges });
                },
                {},
            );
    }
}
