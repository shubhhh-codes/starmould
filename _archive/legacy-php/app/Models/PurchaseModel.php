<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;


class PurchaseModel extends Model
{
    protected $table = 'purchase';
    public function categories()
    {
        
        //return $this->belongsToMany(ChallanItemsModel::class, 'challan_items', 'challanid','plateid','particulars','cdescription','qty', 'categoryid')->withTimestamps();
          return $this->belongsToMany(PurchaseItemsModel::class, 'purchase_items', 'pid', 'plateid')
                       ->withPivot('imaterial','material','materialtype', 'qty', 'categoryid')
                       ->withTimestamps(); 
    }
    public function purchaseItems()
    {
        return $this->hasMany(PurchaseItemsModel::class, 'pid', 'id'); // Assuming 'pid' is the foreign key in PurchaseItem table
    }
    public function customer()
    {
        return $this->belongsTo(CustomerModel::class, 'cname','id');
    }
    public function vendor()
    {
        return $this->belongsTo(CustomerModel::class, 'vname','id');
    }
    public function scanning()
    {
        return $this->belongsTo(ScanningModel::class, 'projectid','projectid');
    }
    public function purchaseinwardItems()
    {
        return $this->hasMany(PurchaseItemsModel::class, 'pid', 'id'); // Assuming 'pid' is the foreign key in PurchaseItem table
    }
}