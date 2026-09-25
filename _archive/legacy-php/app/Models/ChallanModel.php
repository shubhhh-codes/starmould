<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChallanModel extends Model
{
    protected $table = 'challan';

    public function categories()
    {
        
        //return $this->belongsToMany(ChallanItemsModel::class, 'challan_items', 'challanid','plateid','particulars','cdescription','qty', 'categoryid')->withTimestamps();
          return $this->belongsToMany(ChallanItemsModel::class, 'challan_items', 'challanid', 'plateid')
                       ->withPivot('particulars', 'qty','customer','project','categoryid')
                       ->withTimestamps(); 
    }
    public function outwardItems()
    {
        return $this->hasMany(ChallanItemsModel::class, 'challanid', 'id'); // Assuming 'pid' is the foreign key in PurchaseItem table
    }
    public function transporter()
    {
        return $this->belongsTo(CustomerModel::class, 'vendortid','id');
    }
    public function vendor()
    {
        return $this->belongsTo(CustomerModel::class, 'vendorid','id');
    }
    public function pendingoutwardItems()
    {
        return $this->hasMany(ChallanItemsModel::class, 'challanid', 'id'); // Assuming 'pid' is the foreign key in PurchaseItem table
    }
  
    
}
