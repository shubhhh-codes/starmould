<?php


namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ViewPurchaseModel extends Model
{
    protected $table = 'view_po_pending_inward_qty';
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