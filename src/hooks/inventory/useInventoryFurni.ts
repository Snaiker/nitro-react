import { FurnitureListAddOrUpdateEvent, FurnitureListComposer, FurnitureListEvent, FurnitureListInvalidateEvent, FurnitureListItemParser, FurnitureListRemovedEvent, FurniturePostItPlacedEvent } from '@nitrots/nitro-renderer';
import { useCallback, useEffect, useState } from 'react';
import { useBetween } from 'use-between';
import { useInventoryUnseenTracker } from '.';
import { UseMessageEventHook } from '..';
import { attemptItemPlacement, cancelRoomObjectPlacement, CloneObject, CreateLinkEvent, FurnitureItem, getPlacingItemId, GroupItem, SendMessageComposer, UnseenItemCategory } from '../../api';
import { useSharedVisibility } from '../useSharedVisibility';
import { addFurnitureItem, getAllItemIds, mergeFurniFragments } from './common';

let furniMsgFragments: Map<number, FurnitureListItemParser>[] = null;

const useInventoryFurniState = () =>
{
    const [ isVisible, setIsVisible ] = useState(false);
    const [ needsUpdate, setNeedsUpdate ] = useState(true);
    const [ groupItems, setGroupItems ] = useState<GroupItem[]>([]);
    const [ selectedItem, setSelectedItem ] = useState<GroupItem>(null);
    const { isUnseen = null, removeUnseen = null, resetCategory = null, getCount = null } = useInventoryUnseenTracker();

    const selectItem = (item: GroupItem) =>
    {
        //removeUnseen(UnseenItemCategory.FURNI, item.id);

        setSelectedItem(item);
    }

    const onFurnitureListAddOrUpdateEvent = useCallback((event: FurnitureListAddOrUpdateEvent) =>
    {
        const parser = event.getParser();

        setGroupItems(prevValue =>
            {
                const newValue = [ ...prevValue ];

                for(const item of parser.items)
                {
                    let i = 0;
                    let groupItem: GroupItem = null;

                    while(i < newValue.length)
                    {
                        const group = newValue[i];

                        let j = 0;

                        while(j < group.items.length)
                        {
                            const furniture = group.items[j];

                            if(furniture.id === item.itemId)
                            {
                                furniture.update(item);

                                const newFurniture = [ ...group.items ];

                                newFurniture[j] = furniture;

                                group.items = newFurniture;

                                groupItem = group;

                                break;
                            }

                            j++
                        }

                        if(groupItem) break;

                        i++;
                    }

                    if(groupItem)
                    {
                        groupItem.hasUnseenItems = true;

                        newValue[i] = CloneObject(groupItem);
                    }
                    else
                    {
                        const furniture = new FurnitureItem(item);

                        addFurnitureItem(newValue, furniture, isUnseen(UnseenItemCategory.FURNI, item.itemId));
                    }
                }

                return newValue;
            });
    }, [ isUnseen ]);

    UseMessageEventHook(FurnitureListAddOrUpdateEvent, onFurnitureListAddOrUpdateEvent);

    const onFurnitureListEvent = useCallback((event: FurnitureListEvent) =>
    {
        const parser = event.getParser();
        
        if(!furniMsgFragments) furniMsgFragments = new Array(parser.totalFragments);

        const fragment = mergeFurniFragments(parser.fragment, parser.totalFragments, parser.fragmentNumber, furniMsgFragments);

        if(!fragment) return;

        setGroupItems(prevValue =>
            {
                const newValue = [ ...prevValue ];
                const existingIds = getAllItemIds(newValue);

                for(const existingId of existingIds)
                {
                    if(fragment.get(existingId)) continue;

                    let index = 0;

                    while(index < newValue.length)
                    {
                        const group = newValue[index];
                        const item = group.remove(existingId);

                        if(!item)
                        {
                            index++;

                            continue;
                        }
                        
                        if(getPlacingItemId() === item.ref)
                        {
                            cancelRoomObjectPlacement();

                            if(!attemptItemPlacement(group))
                            {
                                CreateLinkEvent('inventory/show');
                            }
                        }

                        if(group.getTotalCount() <= 0)
                        {
                            newValue.splice(index, 1);

                            group.dispose();
                        }

                        break;
                    }
                }

                for(const itemId of fragment.keys())
                {
                    if(existingIds.indexOf(itemId) >= 0) continue;

                    const parser = fragment.get(itemId);

                    if(!parser) continue;

                    const item = new FurnitureItem(parser);

                    addFurnitureItem(newValue, item, isUnseen(UnseenItemCategory.FURNI, itemId));

                }

                return newValue;
            });

        furniMsgFragments = null;
    }, [ isUnseen ]);

    UseMessageEventHook(FurnitureListEvent, onFurnitureListEvent);

    const onFurnitureListInvalidateEvent = useCallback((event: FurnitureListInvalidateEvent) =>
    {
        setNeedsUpdate(true);
    }, []);

    UseMessageEventHook(FurnitureListInvalidateEvent, onFurnitureListInvalidateEvent);

    const onFurnitureListRemovedEvent = useCallback((event: FurnitureListRemovedEvent) =>
    {
        const parser = event.getParser();

        setGroupItems(prevValue =>
            {
                const newValue = [ ...prevValue ];

                let index = 0;

                while(index < newValue.length)
                {
                    const group = newValue[index];
                    const item = group.remove(parser.itemId);

                    if(!item)
                    {
                        index++;

                        continue;
                    }
                    
                    if(getPlacingItemId() === item.ref)
                    {
                        cancelRoomObjectPlacement();

                        if(!attemptItemPlacement(group)) CreateLinkEvent('inventory/show');
                    }

                    if(group.getTotalCount() <= 0)
                    {
                        newValue.splice(index, 1);

                        group.dispose();
                    }

                    break;
                }

                return newValue;
            });
    }, []);

    UseMessageEventHook(FurnitureListRemovedEvent, onFurnitureListRemovedEvent);

    const onFurniturePostItPlacedEvent = useCallback((event: FurniturePostItPlacedEvent) =>
    {

    }, []);

    UseMessageEventHook(FurniturePostItPlacedEvent, onFurniturePostItPlacedEvent);

    useEffect(() =>
    {
        if(!groupItems || !groupItems.length) return;

        setSelectedItem(prevValue =>
            {
                let newValue = prevValue;

                if(newValue && (groupItems.indexOf(newValue) === -1)) newValue = null;

                if(!newValue) newValue = groupItems[0];

                return newValue;
            });
    }, [ groupItems ]);

    useEffect(() =>
    {
        if(!isVisible || !needsUpdate) return;

        SendMessageComposer(new FurnitureListComposer());

        setNeedsUpdate(false);
    }, [ isVisible, needsUpdate ]);

    return { groupItems, setGroupItems, selectedItem, selectItem, setIsVisible };
}

export const useInventoryFurni = () =>
{
    const { setIsVisible, ...rest } = useBetween(useInventoryFurniState);
    const { isVisible = false, activate = null, deactivate = null } = useSharedVisibility();

    useEffect(() =>
    {
        const id = activate();

        return () => deactivate(id);
    }, [ activate, deactivate ]);

    useEffect(() =>
    {
        setIsVisible(isVisible);
    }, [ isVisible, setIsVisible ]);

    return { ...rest };
}