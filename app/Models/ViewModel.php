<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ViewModel extends Model
{
    protected $table = 'view_pending_inward_qty';
    public function transporter()
    {
        return $this->belongsTo(CustomerModel::class, 'vendortid','id');
    }
    public function vendor()
    {
        return $this->belongsTo(CustomerModel::class, 'vendorid','id');
    }
    public function customer()
    {
        return $this->belongsTo(CustomerModel::class, 'customer','id'); 
    }
    public function pendingoutwardItems()
    {
        return $this->hasMany(ChallanItemsModel::class,'challanid', 'id'); // Assuming 'pid' is the foreign key in PurchaseItem table
    }
}
