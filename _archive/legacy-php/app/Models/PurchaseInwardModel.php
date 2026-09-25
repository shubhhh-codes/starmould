<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PurchaseInwardModel extends Model
{
    protected $table = 'po_inward';

    public function categories()
    {
        
        //return $this->belongsToMany(ChallanItemsModel::class, 'challan_items', 'challanid','plateid','particulars','cdescription','qty', 'categoryid')->withTimestamps();
          return $this->belongsToMany(PurchaseInwardItemsModel::class, 'purchase_inward_items', 'inpid', 'plateid')
                       ->withPivot('material', 'materialtype', 'qty','inward_qty','pending_qty','categoryid')
                       ->withTimestamps(); 
    }
}
