<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InwardModel extends Model
{
    protected $table = 'inward';

    public function categories()
    {
        
        //return $this->belongsToMany(ChallanItemsModel::class, 'challan_items', 'challanid','plateid','particulars','cdescription','qty', 'categoryid')->withTimestamps();
          return $this->belongsToMany(InwardItemsModel::class, 'inward_items', 'inchallanid', 'plateid')
                       ->withPivot('particulars', 'cdescription', 'qty','inward_qty','pending_qty','categoryid')
                       ->withTimestamps(); 
    }
}
