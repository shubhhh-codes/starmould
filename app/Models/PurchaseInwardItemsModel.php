<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PurchaseInwardItemsModel extends Model
{
    protected $table = 'purchase_inward_items';
    public function subplate()
    {
        return $this->belongsTo(SubplateModel::class, 'plateid');
    }
}
