<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DispatchModel extends Model
{
    protected $table = 'dispatch';

    public function categories()
    {
        
        //return $this->belongsToMany(ChallanItemsModel::class, 'challan_items', 'challanid','plateid','particulars','cdescription','qty', 'categoryid')->withTimestamps();
          return $this->belongsToMany(DispatchItemsModel::class, 'dispatch_items', 'dispatchid', 'plateid')
                       ->withPivot('particulars', 'condition', 'work', 'qty','customer','project','categoryid')
                       ->withTimestamps(); 
    }
    public function outwardItems()
    {
        return $this->hasMany(DispatchItemsModel::class, 'dispatchid', 'id'); // Assuming 'pid' is the foreign key in PurchaseItem table
    }
    public function transporter()
    {
        return $this->belongsTo(CustomerModel::class, 'vendortid','id');
    }
    public function vendor()
    {
        return $this->belongsTo(CustomerModel::class, 'vendorid','id');
    }
    public function customers()
    {
        return $this->belongsTo(CustomerModel::class, 'customerid');
    }
    public function pendingoutwardItems()
    {
        return $this->hasMany(DispatchItemsModel::class, 'dispatchid', 'id'); // Assuming 'pid' is the foreign key in PurchaseItem table
    }
  
    //brijesh for datatable
    public function customer() {
        return $this->belongsTo(CustomerModel::class, 'customerid');
    }
    public function dispatchItems()
{
    return $this->hasMany(\App\Models\DispatchItemsModel::class, 'dispatchid', 'id');
}

    
    
    
}
